"use client";

import { useState } from "react";
import { type Editor } from "@tiptap/react";
import { Sparkles, X, Loader2, Copy, Check, Wand2, AlignLeft, LayoutList, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  editor: Editor;
  documentId: string;
  onClose: () => void;
}

type AIMode = "summary" | "keypoints" | "tldr" | "grammar" | "rephrase" | "expand" | "shorten";

export default function AISidebar({ editor, documentId, onClose }: Props) {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeMode, setActiveMode] = useState<AIMode | null>(null);

  const getSelectedOrAll = () => {
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      return editor.state.doc.textBetween(from, to, " ");
    }
    return editor.getText();
  };

  const runSummarize = async (mode: "summary" | "keypoints" | "tldr") => {
    const content = getSelectedOrAll();
    if (!content.trim()) { setError("Document is empty."); return; }
    setLoading(true); setError(null); setResult(null); setActiveMode(mode);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, content, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI failed");
      setResult(data.result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const runImprove = async (mode: "grammar" | "rephrase" | "expand" | "shorten") => {
    const { from, to, empty } = editor.state.selection;
    const text = empty ? editor.getText().slice(0, 2000) : editor.state.doc.textBetween(from, to, " ");
    if (!text.trim()) { setError("Select text or write something first."); return; }
    setLoading(true); setError(null); setResult(null); setActiveMode(mode);
    try {
      const res = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI failed");
      setResult(data.result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const insertResult = () => {
    if (!result) return;
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      editor.chain().focus().deleteSelection().insertContent(result).run();
    } else {
      editor.chain().focus().insertContent("\n\n" + result).run();
    }
    setResult(null);
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-72 border-l border-gray-100 bg-gray-50/50 flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-gray-900 text-sm">AI Assistant</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summarize section */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Summarize</p>
          <div className="space-y-1.5">
            {[
              { mode: "summary" as const, label: "Full Summary", icon: <AlignLeft className="w-3.5 h-3.5" /> },
              { mode: "keypoints" as const, label: "Key Points", icon: <LayoutList className="w-3.5 h-3.5" /> },
              { mode: "tldr" as const, label: "TL;DR", icon: <FileText className="w-3.5 h-3.5" /> },
            ].map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => runSummarize(mode)}
                disabled={loading}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-left",
                  activeMode === mode && loading && "bg-indigo-50 border-indigo-200 text-indigo-700"
                )}
              >
                {activeMode === mode && loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Improve section */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Improve Selection</p>
          <div className="space-y-1.5">
            {[
              { mode: "grammar" as const, label: "Fix Grammar" },
              { mode: "rephrase" as const, label: "Rephrase" },
              { mode: "expand" as const, label: "Expand" },
              { mode: "shorten" as const, label: "Shorten" },
            ].map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => runImprove(mode)}
                disabled={loading}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-left",
                  activeMode === mode && loading && "bg-indigo-50 border-indigo-200 text-indigo-700"
                )}
              >
                {activeMode === mode && loading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
              {result}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyResult} className="flex-1">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button size="sm" onClick={insertResult} className="flex-1">
                Insert
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">Powered by Groq · Llama 3.1</p>
      </div>
    </aside>
  );
}
