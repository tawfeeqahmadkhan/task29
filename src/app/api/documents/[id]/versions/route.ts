import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDocumentAccess, canEdit } from "@/lib/document-access";
import { z } from "zod";

const createVersionSchema = z.object({
  description: z.string().max(500).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ versions });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(access.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { yjsState: true, title: true, textContent: true },
  });

  if (!doc?.yjsState) {
    return NextResponse.json({ error: "No content to snapshot" }, { status: 400 });
  }

  const version = await prisma.documentVersion.create({
    data: {
      documentId: id,
      title: doc.title,
      yjsState: doc.yjsState,
      textSnapshot: doc.textContent,
      description: parsed.data.description,
      createdById: session.user.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true, image: true } },
    },
  });

  return NextResponse.json({ version }, { status: 201 });
}
