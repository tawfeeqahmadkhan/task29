import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDocumentAccess, canEdit } from "@/lib/document-access";
import * as Y from "yjs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, versionId } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(access.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, documentId: id },
    select: { yjsState: true, title: true, textSnapshot: true },
  });

  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Create snapshot of current state before restoring
  const currentDoc = await prisma.document.findUnique({
    where: { id },
    select: { yjsState: true, title: true, textContent: true },
  });

  await prisma.$transaction(async (tx) => {
    // Save current state as a version (pre-restore snapshot)
    if (currentDoc?.yjsState) {
      await tx.documentVersion.create({
        data: {
          documentId: id,
          title: `[Pre-restore] ${currentDoc.title}`,
          yjsState: currentDoc.yjsState,
          textSnapshot: currentDoc.textContent,
          description: `Automatic snapshot before restoring version`,
          createdById: session.user.id,
        },
      });
    }

    // Apply the restored Yjs state as a fresh update to preserve CRDT semantics
    const restoredDoc = new Y.Doc();
    Y.applyUpdate(restoredDoc, new Uint8Array(version.yjsState));
    const restoredState = Y.encodeStateAsUpdate(restoredDoc);
    restoredDoc.destroy();

    await tx.document.update({
      where: { id },
      data: {
        yjsState: Buffer.from(restoredState),
        title: version.title,
        textContent: version.textSnapshot,
        updatedAt: new Date(),
      },
    });
  });

  const updatedDoc = await prisma.document.findUnique({
    where: { id },
    select: { yjsState: true, title: true },
  });

  return NextResponse.json({
    yjsState: updatedDoc?.yjsState ? Buffer.from(updatedDoc.yjsState).toString("base64") : null,
    title: updatedDoc?.title ?? version.title,
  });
}
