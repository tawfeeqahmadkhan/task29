"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import DocumentCard from "@/components/dashboard/DocumentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileText, Plus, Search, LogOut, User, Loader2 } from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { DocumentMeta } from "@/types";

interface Props {
  user: { name: string | null; email: string; image: string | null };
  initialDocuments: DocumentMeta[];
}

export default function DashboardClient({ user, initialDocuments }: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const createDocument = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Document" }),
      });
      const data = await res.json();
      if (data.document?.id) {
        router.push(`/documents/${data.document.id}`);
      }
    } catch {
      /* handle error */
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-2 mr-4">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 hidden sm:block">CollabDocs</span>
          </div>

          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Button onClick={createDocument} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="hidden sm:inline">New Document</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full">
                  <Avatar className="w-9 h-9 cursor-pointer">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{user.name ?? "User"}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                  <LogOut className="w-4 h-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {search ? `Results for "${search}"` : "All Documents"}
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {filtered.length} document{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <FileText className="w-8 h-8 text-indigo-300" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-700">
                {search ? "No documents found" : "No documents yet"}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {search ? "Try a different search term" : "Create your first document to get started"}
              </p>
            </div>
            {!search && (
              <Button onClick={createDocument} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                New Document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((doc) => (
              <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
          <span>CollabDocs — Local-First Collaborative Editor</span>
          <div className="flex items-center gap-4">
            <span>Built by <a href="https://github.com/tawfeeqpathan3" className="text-indigo-500 hover:underline">Tawfeeq Pathan</a></span>
            <a href="https://github.com/tawfeeqpathan3" className="hover:text-gray-600">GitHub</a>
            <a href="https://linkedin.com/in/tawfeeqpathan3" className="hover:text-gray-600">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
