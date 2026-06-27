"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, MoreHorizontal, Trash2, Users, ExternalLink, Crown, Edit3, Eye } from "lucide-react";
import type { DocumentMeta } from "@/types";

interface Props {
  document: DocumentMeta;
  onDelete: (id: string) => void;
}

const roleIcons: Record<string, React.ReactNode> = { OWNER: <Crown className="w-3 h-3" />, EDITOR: <Edit3 className="w-3 h-3" />, VIEWER: <Eye className="w-3 h-3" /> };
const roleVariants: Record<string, "default" | "success" | "secondary"> = { OWNER: "default", EDITOR: "success", VIEWER: "secondary" };

export default function DocumentCard({ document, onDelete }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${document.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/${document.id}`, { method: "DELETE" });
      if (res.ok) onDelete(document.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={() => router.push(`/documents/${document.id}`)}
      className="group relative flex flex-col gap-3 p-5 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer"
    >
      {/* Top */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate text-sm leading-tight">{document.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{formatRelativeTime(document.updatedAt)}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => router.push(`/documents/${document.id}`)}>
              <ExternalLink className="w-4 h-4" /> Open
            </DropdownMenuItem>
            {document.role === "OWNER" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} disabled={deleting} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                  <Trash2 className="w-4 h-4" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <Badge variant={roleVariants[document.role]} className="gap-1">
          {roleIcons[document.role]}
          {document.role.charAt(0) + document.role.slice(1).toLowerCase()}
        </Badge>
        {document.collaboratorCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3.5 h-3.5" />
            {document.collaboratorCount}
          </div>
        )}
      </div>
    </div>
  );
}
