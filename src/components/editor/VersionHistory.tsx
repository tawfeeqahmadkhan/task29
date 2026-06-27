"use client";

import { useState, useEffect } from "react";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, History, RotateCcw, Plus, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { VersionMeta } from "@/types";

interface Props {
  documentId: string;
  canEdit: boolean;
  onRestore: (yjsState: string) => void;
  onClose: () => void;
}

export default function VersionHistory({ documentId, canEdit, onRestore, onClose }: Props) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  const fetchVersions = async () => {
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchVersions(); }, [documentId]);

  const createSnapshot = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description || undefined }),
      });
      if (res.ok) {
        setDescription("");
        await fetchVersions();
      }
    } finally {
      setCreating(false);
    }
  };

  const restore = async (versionId: string) => {
    if (!confirm("Restore this version? The current state will be saved as a pre-restore snapshot.")) return;
    setRestoring(versionId);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions/${versionId}/restore`, { method: "POST" });
      const data = await res.json();
      if (data.yjsState) {
        onRestore(data.yjsState);
        await fetchVersions();
      }
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-white border-l border-gray-100 shadow-xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-gray-900 text-sm">Version History</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {canEdit && (
        <div className="p-4 border-b border-gray-100 space-y-2">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Snapshot description (optional)"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            maxLength={200}
          />
          <Button onClick={createSnapshot} disabled={creating} size="sm" className="w-full">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {creating ? "Saving…" : "Save Snapshot"}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <History className="w-8 h-8 opacity-30" />
            <p className="text-sm">No snapshots yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {versions.map((v) => (
              <li key={v.id} className="p-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.title}</p>
                    {v.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{v.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Avatar className="w-4 h-4">
                        <AvatarImage src={v.createdBy.image ?? undefined} />
                        <AvatarFallback className="text-[8px]">
                          {getInitials(v.createdBy.name, v.createdBy.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-gray-400">
                        {v.createdBy.name ?? v.createdBy.email} · {formatRelativeTime(v.createdAt)}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => restore(v.id)}
                      disabled={restoring === v.id}
                      title="Restore this version"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    >
                      {restoring === v.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
