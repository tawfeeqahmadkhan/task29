import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Wifi, History, Sparkles, Users, Shield } from "lucide-react";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">CollabDocs</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign in</Link>
            <Link href="/register" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-xs text-indigo-700 font-medium mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          Local-First · AI-Powered · Real-Time Collaborative
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
          Write together,<br />
          <span className="text-indigo-600">even offline.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          CollabDocs is a local-first collaborative editor. Your work lives in your browser first —
          syncing seamlessly when you're back online, with deterministic CRDT-based conflict resolution.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="px-8 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm text-base">
            Start writing for free
          </Link>
          <Link href="/login" className="px-8 py-3.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-base">
            Sign in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Wifi className="w-5 h-5 text-indigo-600" />,
              title: "Works 100% Offline",
              desc: "Edit documents without any network requests. IndexedDB persists your changes locally. Automatic background sync when you reconnect.",
            },
            {
              icon: <Users className="w-5 h-5 text-green-600" />,
              title: "Real-Time Collaboration",
              desc: "Share with Owner, Editor, or Viewer roles. Changes from collaborators stream in via SSE. Viewers can never corrupt state.",
            },
            {
              icon: <History className="w-5 h-5 text-amber-600" />,
              title: "Version Time Travel",
              desc: "Capture named snapshots. Browse a timeline and restore any version — your current state is preserved as a pre-restore snapshot.",
            },
            {
              icon: <Sparkles className="w-5 h-5 text-purple-600" />,
              title: "AI Writing Assistant",
              desc: "Summarize, extract key points, fix grammar, rephrase, expand or shorten text — powered by Groq's ultra-fast Llama inference.",
            },
            {
              icon: <Shield className="w-5 h-5 text-red-600" />,
              title: "Secure by Design",
              desc: "5MB payload limits, Zod validation, role-based access control, Yjs update verification, and PostgreSQL Row-Level Security.",
            },
            {
              icon: <FileText className="w-5 h-5 text-blue-600" />,
              title: "CRDT Conflict Resolution",
              desc: "Yjs CRDT merges concurrent edits deterministically — no lost work, no last-write-wins data destruction, even after long offline periods.",
            },
          ].map((f) => (
            <div key={f.title} className="p-6 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-4">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <FileText className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-gray-600">CollabDocs</span>
            <span>— House of EdTech Assignment</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built by <a href="https://github.com/tawfeeqpathan3" className="text-indigo-600 hover:underline font-medium">Tawfeeq Pathan</a></span>
            <a href="https://github.com/tawfeeqpathan3" className="hover:text-gray-600 transition-colors">GitHub</a>
            <a href="https://linkedin.com/in/tawfeeqpathan3" className="hover:text-gray-600 transition-colors">LinkedIn</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
