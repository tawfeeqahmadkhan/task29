"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import CharacterCount from "@tiptap/extension-character-count";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { SyncEngine } from "@/lib/sync/SyncEngine";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { SYNC_DEBOUNCE_MS, POLL_INTERVAL_MS } from "@/lib/utils";
import type { Role, NetworkStatus } from "@/types";
import EditorToolbar from "./EditorToolbar";
import NetworkStatusIndicator from "./NetworkStatusIndicator";
import VersionHistory from "./VersionHistory";
import AISidebar from "./AISidebar";
import ShareDialog from "../dashboard/ShareDialog";
import { Users, History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  documentId: string;
  initialTitle: string;
  initialYjsState: string | null;
  role: Role;
  collaborators: Array<{ id: string; userId: string; role: Role; user: { name: string | null; email: string; image: string | null } }>;
}

export default function CollaborativeEditor({ documentId, initialTitle, initialYjsState, role, collaborators }: Props) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [title, setTitle] = useState(initialTitle);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("online");
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  const { status, isOnline } = useNetworkStatus();
  const canEdit = role === "OWNER" || role === "EDITOR";

  // Initialise Y.Doc once
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({ document: ydocRef.current }),
      Placeholder.configure({ placeholder: canEdit ? "Start writing your document…" : "This document is read-only." }),
      Link.configure({ openOnClick: false, autolink: true }),
      Typography,
      CharacterCount,
    ],
    editable: canEdit,
    editorProps: {
      attributes: {
        class: "prose prose-gray max-w-none focus:outline-none min-h-[calc(100vh-220px)] px-2",
      },
    },
    onUpdate: ({ editor }) => {
      setWordCount(editor.storage.characterCount?.words() ?? 0);
      if (!canEdit) return;
      scheduleSyncPush();
    },
  });

  // Bootstrap IndexedDB persistence + merge server state
  useEffect(() => {
    const ydoc = ydocRef.current!;
    const persistence = new IndexeddbPersistence(`doc-${documentId}`, ydoc);

    persistence.on("synced", () => {
      // After local DB syncs, layer in server state (CRDT merge — no data loss)
      if (initialYjsState) {
        try {
          const serverBytes = Uint8Array.from(Buffer.from(initialYjsState, "base64"));
          Y.applyUpdate(ydoc, serverBytes);
        } catch { /* malformed state — skip */ }
      }
    });

    return () => { persistence.destroy(); };
  }, [documentId, initialYjsState]);

  // Wire up sync engine
  useEffect(() => {
    const engine = new SyncEngine(setNetworkStatus);
    syncEngineRef.current = engine;

    // Flush any queued offline changes on mount
    if (isOnline) engine.flush();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // SSE subscription for real-time remote updates
  useEffect(() => {
    if (!isOnline) return;

    const evtSource = new EventSource(`/api/documents/${documentId}/sse`);

    evtSource.addEventListener("update", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.yjsState && ydocRef.current) {
          const serverBytes = Uint8Array.from(Buffer.from(data.yjsState, "base64"));
          Y.applyUpdate(ydocRef.current, serverBytes);
        }
        if (data.title) setTitle(data.title);
      } catch { /* ignore malformed events */ }
    });

    evtSource.onerror = () => evtSource.close();

    return () => evtSource.close();
  }, [documentId, isOnline]);

  // When coming back online — flush queue + pull latest
  useEffect(() => {
    if (status === "online" && syncEngineRef.current && ydocRef.current) {
      syncEngineRef.current.flush();
      syncEngineRef.current.pullAndMerge(documentId, ydocRef.current).then((serverTitle) => {
        if (serverTitle) setTitle(serverTitle);
      });
    }
  }, [status, documentId]);

  const scheduleSyncPush = useCallback(() => {
    if (!canEdit || !syncEngineRef.current || !ydocRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const engine = syncEngineRef.current!;
      engine.enqueue(documentId, title, ydocRef.current!);
      if (isOnline) {
        setIsSyncing(true);
        engine.flush().finally(() => setIsSyncing(false));
      }
    }, SYNC_DEBOUNCE_MS);
  }, [canEdit, documentId, title, isOnline]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    scheduleSyncPush();
  };

  const handleRestoreVersion = (yjsState: string) => {
    if (!ydocRef.current) return;
    try {
      const bytes = Uint8Array.from(Buffer.from(yjsState, "base64"));
      Y.applyUpdate(ydocRef.current, bytes);
    } catch { /* invalid restore state */ }
    setShowVersionHistory(false);
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Top bar */}
      <header className="flex items-center gap-3 px-6 py-3 border-b border-gray-100 bg-white/95 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          {canEdit ? (
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="flex-1 min-w-0 text-lg font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0 placeholder:text-gray-400 truncate"
              placeholder="Untitled Document"
              maxLength={200}
            />
          ) : (
            <span className="flex-1 min-w-0 text-lg font-semibold text-gray-900 truncate">{title}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NetworkStatusIndicator status={networkStatus} isSyncing={isSyncing} pendingCount={syncEngineRef.current?.pendingCount ?? 0} />

          {/* Collaborator avatars */}
          <div className="hidden sm:flex items-center -space-x-2">
            {collaborators.slice(0, 4).map((c) => (
              <div
                key={c.id}
                title={`${c.user.name ?? c.user.email} (${c.role.toLowerCase()})`}
                className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-semibold text-indigo-700"
              >
                {c.user.image ? (
                  <img src={c.user.image} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (c.user.name?.[0] ?? c.user.email[0]).toUpperCase()
                )}
              </div>
            ))}
            {collaborators.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs text-gray-600 font-medium">
                +{collaborators.length - 4}
              </div>
            )}
          </div>

          {role === "OWNER" && (
            <Button variant="outline" size="sm" onClick={() => setShowShare(true)}>
              <Users className="w-4 h-4" /> Share
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setShowVersionHistory(true)} title="Version history">
            <History className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowAI(!showAI)} title="AI Assistant" className={showAI ? "bg-indigo-50 text-indigo-600" : ""}>
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Toolbar */}
      {canEdit && editor && <EditorToolbar editor={editor} />}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-10">
            <EditorContent editor={editor} />
          </div>
        </main>

        {/* AI Sidebar */}
        {showAI && editor && (
          <AISidebar
            editor={editor}
            documentId={documentId}
            onClose={() => setShowAI(false)}
          />
        )}
      </div>

      {/* Status bar */}
      <footer className="flex items-center justify-between px-6 py-1.5 border-t border-gray-100 text-xs text-gray-400 bg-gray-50">
        <span>{wordCount} words</span>
        <span className="capitalize">{role.toLowerCase()} access</span>
      </footer>

      {/* Version History Panel */}
      {showVersionHistory && (
        <VersionHistory
          documentId={documentId}
          canEdit={canEdit}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {/* Share Dialog */}
      {showShare && (
        <ShareDialog
          documentId={documentId}
          collaborators={collaborators}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
