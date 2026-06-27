import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const inv = await prisma.shareInvitation.findUnique({
    where: { token },
    include: {
      document: { select: { id: true, title: true, owner: { select: { name: true, email: true } } } },
    },
  });

  if (!inv || inv.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  return NextResponse.json({
    invitation: {
      email: inv.email,
      role: inv.role,
      document: inv.document,
      expiresAt: inv.expiresAt,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await params;
  const inv = await prisma.shareInvitation.findUnique({ where: { token } });

  if (!inv || inv.expiresAt < new Date() || inv.acceptedAt) {
    return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 404 });
  }

  if (inv.email !== session.user.email) {
    return NextResponse.json({ error: "This invitation was sent to a different email" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.documentCollaborator.upsert({
      where: { documentId_userId: { documentId: inv.documentId, userId: session.user.id } },
      update: { role: inv.role },
      create: { documentId: inv.documentId, userId: session.user.id, role: inv.role },
    }),
    prisma.shareInvitation.update({
      where: { id: inv.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ documentId: inv.documentId, role: inv.role });
}
