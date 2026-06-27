"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Invitation {
  email: string;
  role: "EDITOR" | "VIEWER";
  document: { id: string; title: string; owner: { name: string | null; email: string } };
  expiresAt: string;
}

interface Props {
  token: string;
  invitation: Invitation;
  isLoggedIn: boolean;
}

export default function InviteClient({ token, invitation, isLoggedIn }: Props) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invite/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to accept"); return; }
      setAccepted(true);
      setTimeout(() => router.push(`/documents/${data.documentId}`), 1500);
    } catch {
      setError("Network error");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You're invited!</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-1">Document</p>
              <p className="font-semibold text-gray-900">{invitation.document.title}</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Shared by</span>
              <span className="font-medium text-gray-900">
                {invitation.document.owner.name ?? invitation.document.owner.email}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Your role</span>
              <Badge variant={invitation.role === "EDITOR" ? "success" : "secondary"}>
                {invitation.role === "EDITOR" ? "Editor" : "Viewer"}
              </Badge>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
          )}

          {accepted ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-green-50 rounded-xl text-green-700 text-sm font-medium">
              <Check className="w-4 h-4" /> Invitation accepted! Redirecting…
            </div>
          ) : (
            <Button onClick={accept} disabled={accepting} className="w-full">
              {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isLoggedIn ? "Accept Invitation" : "Sign in to Accept"}
            </Button>
          )}

          <p className="text-xs text-center text-gray-400">
            This invitation expires {new Date(invitation.expiresAt).toLocaleDateString()}.
          </p>
        </div>
      </div>
    </div>
  );
}
