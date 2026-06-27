"use client";
import * as Y from "yjs";
import type { NetworkStatus, PendingSyncItem } from "@/types";

const QUEUE_KEY = "docsync_queue";
const MAX_RETRIES = 5;
const RETRY_BACKOFF = [2000, 4000, 8000, 16000, 30000];

function loadQueue(): PendingSyncItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingSyncItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export class SyncEngine {
  private queue: PendingSyncItem[] = [];
  private flushing = false;
  private onStatusChange: (s: NetworkStatus) => void;

  constructor(onStatusChange: (s: NetworkStatus) => void) {
    this.onStatusChange = onStatusChange;
    this.queue = loadQueue();
  }

  enqueue(documentId: string, title: string, ydoc: Y.Doc) {
    const yjsUpdate = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString("base64");

    // Deduplicate: replace existing entry for same document
    this.queue = this.queue.filter((q) => q.documentId !== documentId);
    this.queue.push({ documentId, title, yjsUpdate, timestamp: Date.now(), retries: 0 });
    saveQueue(this.queue);
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    if (!navigator.onLine) return;

    this.flushing = true;
    this.onStatusChange("syncing");

    const toProcess = [...this.queue];
    const failed: PendingSyncItem[] = [];

    for (const item of toProcess) {
      try {
        const res = await fetch(`/api/documents/${item.documentId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            yjsUpdate: item.yjsUpdate,
            clientTimestamp: item.timestamp,
          }),
        });

        if (!res.ok) {
          const retryable = res.status >= 500;
          if (retryable && item.retries < MAX_RETRIES) {
            failed.push({ ...item, retries: item.retries + 1 });
          }
          // 4xx errors are permanent failures — drop them
        }
      } catch {
        // Network error — keep for retry
        if (item.retries < MAX_RETRIES) {
          failed.push({ ...item, retries: item.retries + 1 });
        }
      }
    }

    this.queue = failed;
    saveQueue(this.queue);
    this.flushing = false;
    this.onStatusChange(failed.length > 0 ? "error" : "online");
  }

  async pullAndMerge(documentId: string, ydoc: Y.Doc): Promise<string | null> {
    try {
      const res = await fetch(`/api/documents/${documentId}/sync`);
      if (!res.ok) return null;

      const data = await res.json();
      if (data.yjsState) {
        const serverState = Uint8Array.from(Buffer.from(data.yjsState, "base64"));
        Y.applyUpdate(ydoc, serverState);
      }
      return data.title ?? null;
    } catch {
      return null;
    }
  }

  get pendingCount() {
    return this.queue.length;
  }
}
