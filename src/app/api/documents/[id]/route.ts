import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDocumentAccess } from "@/lib/document-access";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role } = access;
  const collaborators = await prisma.documentCollaborator.findMany({
    where: { documentId: id },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  type CollaboratorRow = (typeof collaborators)[number];

  const doc = access.document;
  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      yjsState: doc.yjsState ? Buffer.from(doc.yjsState).toString("base64") : null,
      updatedAt: doc.updatedAt,
      createdAt: doc.createdAt,
      ownerId: doc.ownerId,
      owner: doc.owner,
    },
    role,
    collaborators: collaborators.map((c: CollaboratorRow) => ({
      id: c.id,
      userId: c.userId,
      role: c.role,
      user: c.user,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

    const doc = await prisma.document.update({
      where: { id },
      data: parsed.data,
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json({ document: doc });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
