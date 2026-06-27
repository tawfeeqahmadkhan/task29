import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDocumentAccess, canEdit } from "@/lib/document-access";
import { z } from "zod";
import * as Y from "yjs";
import { MAX_PAYLOAD_SIZE } from "@/lib/utils";

const syncSchema = z.object({
  title: z.string().min(1).max(200),
  yjsUpdate: z.string().max(MAX_PAYLOAD_SIZE * 1.4), // base64 overhead ~33%
  clientTimestamp: z.number().int().positive(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Hard payload size check before parsing
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_SIZE) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(access.role)) {
    return NextResponse.json({ error: "Forbidden: viewers cannot push updates" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = syncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const { title, yjsUpdate, clientTimestamp } = parsed.data;

  let updateBytes: Uint8Array;
  try {
    updateBytes = Uint8Array.from(Buffer.from(yjsUpdate, "base64"));
  } catch {
    return NextResponse.json({ error: "Invalid yjs update encoding" }, { status: 400 });
  }

  // Validate the Yjs update by applying it to a temp doc
  try {
    const testDoc = new Y.Doc();
    Y.applyUpdate(testDoc, updateBytes);
    testDoc.destroy();
  } catch {
    return NextResponse.json({ error: "Malformed Yjs update" }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { yjsState: true, title: true },
  });

  // Merge incoming update with server state
  const serverDoc = new Y.Doc();
  if (doc?.yjsState) {
    Y.applyUpdate(serverDoc, new Uint8Array(doc.yjsState));
  }
  Y.applyUpdate(serverDoc, updateBytes);

  const newState = Y.encodeStateAsUpdate(serverDoc);
  const textContent = serverDoc.getText("content").toString().slice(0, 10000);
  serverDoc.destroy();

  // Persist and audit
  await prisma.$transaction([
    prisma.document.update({
      where: { id },
      data: {
        yjsState: Buffer.from(newState),
        title,
        textContent,
        updatedAt: new Date(),
      },
    }),
    prisma.syncEvent.create({
      data: {
        documentId: id,
        userId: session.user.id,
        eventType: "push",
        payloadSize: updateBytes.byteLength,
      },
    }),
  ]);

  return NextResponse.json({
    serverTimestamp: Date.now(),
    yjsState: Buffer.from(newState).toString("base64"),
    title,
  });
}

// Pull latest state
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { yjsState: true, title: true, updatedAt: true },
  });

  return NextResponse.json({
    serverTimestamp: Date.now(),
    yjsState: doc?.yjsState ? Buffer.from(doc.yjsState).toString("base64") : null,
    title: doc?.title ?? "Untitled Document",
    updatedAt: doc?.updatedAt,
  });
}
