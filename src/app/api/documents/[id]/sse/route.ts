import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDocumentAccess } from "@/lib/document-access";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// SSE endpoint — pushes document state updates to collaborators
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return new Response("Not found", { status: 404 });

  let lastUpdatedAt: Date | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { documentId: id, role: access.role });

      // Poll DB for changes every 3 seconds
      const interval = setInterval(async () => {
        try {
          const doc = await prisma.document.findUnique({
            where: { id },
            select: { yjsState: true, title: true, updatedAt: true },
          });

          if (!doc) {
            clearInterval(interval);
            controller.close();
            return;
          }

          if (lastUpdatedAt === null || doc.updatedAt > lastUpdatedAt) {
            lastUpdatedAt = doc.updatedAt;
            send("update", {
              serverTimestamp: Date.now(),
              yjsState: doc.yjsState ? Buffer.from(doc.yjsState).toString("base64") : null,
              title: doc.title,
              updatedAt: doc.updatedAt,
            });
          }
        } catch {
          clearInterval(interval);
          try { controller.close(); } catch { /* already closed */ }
        }
      }, 3000);

      // Heartbeat every 25s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          clearInterval(interval);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
