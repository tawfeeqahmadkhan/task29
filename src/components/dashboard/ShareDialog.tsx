"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, UserPlus, Trash2, Link2, Check } from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { Role, CollaboratorInfo } from "@/types";

interface Props {
  documentId: string;
  collaborators: CollaboratorInfo[];
  onClose: () => void;
}

const roleColors: Record<string, string> = {
  OWNER: "default",
  EDITOR: "success",
  VIEWER: "secondary",
};

export default function ShareDialog({ documentId, collaborators: initial, onClose }: Props) {
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>(initial);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER">("EDITOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = async () => {
    if (!email.trim()) return;
    setLoading(true); setError(null); setInviteUrl(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to share"); return; }

      if (data.mode === "direct") {
        setCollaborators((prev) => {
          const exists = prev.find((c) => c.userId === data.collaborator.userId);
          if (exists) return prev.map((c) => c.userId === data.collaborator.userId ? { ...c, role: data.collaborator.role } : c);
          return [...prev, data.collaborator];
        });
      } else {
        setInviteUrl(data.inviteUrl);
      }
      setEmail("");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const removeCollaborator = async (collaboratorId: string) => {
    try {
      await fetch(`/api/documents/${documentId}/share?collaboratorId=${collaboratorId}`, { method: "DELETE" });
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
    } catch { /* ignore */ }
  };

  const updateRole = async (collaboratorId: string, newRole: "EDITOR" | "VIEWER") => {
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaboratorId, role: newRole }),
      });
      if (res.ok) {
        setCollaborators((prev) => prev.map((c) => c.id === collaboratorId ? { ...c, role: newRole } : c));
      }
    } catch { /* ignore */ }
  };

  const copyInviteUrl = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>Invite collaborators by email. Editors can write; viewers can only read.</DialogDescription>
        </DialogHeader>

        {/* Invite form */}
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            className="flex-1"
          />
          <Select value={role} onValueChange={(v) => setRole(v as "EDITOR" | "VIEWER")}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EDITOR">Editor</SelectItem>
              <SelectItem value="VIEWER">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={loading || !email.trim()} size="icon">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {inviteUrl && (
          <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
            <Link2 className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-xs text-indigo-700 flex-1 truncate">{inviteUrl}</span>
            <button onClick={copyInviteUrl} className="text-indigo-600 hover:text-indigo-800">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Link2 className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Collaborator list */}
        {collaborators.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">People with access</p>
            <ul className="space-y-2">
              {collaborators.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={c.user.image ?? undefined} />
                    <AvatarFallback>{getInitials(c.user.name, c.user.email)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.user.name ?? c.user.email}</p>
                    {c.user.name && <p className="text-xs text-gray-400 truncate">{c.user.email}</p>}
                  </div>
                  {c.role === "OWNER" ? (
                    <Badge variant="default">Owner</Badge>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Select
                        value={c.role}
                        onValueChange={(v) => updateRole(c.id, v as "EDITOR" | "VIEWER")}
                      >
                        <SelectTrigger className="h-7 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EDITOR">Editor</SelectItem>
                          <SelectItem value="VIEWER">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => removeCollaborator(c.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
