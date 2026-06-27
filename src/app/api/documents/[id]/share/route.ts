import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDocumentAccess } from "@/lib/document-access";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["EDITOR", "VIEWER"]),
});

const updateRoleSchema = z.object({
  collaboratorId: z.string(),
  role: z.enum(["EDITOR", "VIEWER"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.role !== "OWNER") {
    return NextResponse.json({ error: "Only owners can share documents" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, role } = parsed.data;

  // Prevent sharing with yourself
  if (email === session.user.email) {
    return NextResponse.json({ error: "Cannot share with yourself" }, { status: 400 });
  }

  // Check if user exists and add as collaborator directly, otherwise create invitation
  const targetUser = await prisma.user.findUnique({ where: { email } });

  if (targetUser) {
    // Upsert collaborator record
    const collab = await prisma.documentCollaborator.upsert({
      where: { documentId_userId: { documentId: id, userId: targetUser.id } },
      update: { role },
      create: { documentId: id, userId: targetUser.id, role },
      include: { user: { select: { name: true, email: true, image: true } } },
    });

    return NextResponse.json({ collaborator: collab, mode: "direct" });
  }

  // Create invitation token for users not yet registered
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  const inv = await prisma.shareInvitation.create({
    data: { documentId: id, email, role, createdById: session.user.id, expiresAt },
    select: { id: true, token: true, email: true, role: true, expiresAt: true },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL}/invite/${inv.token}`;
  return NextResponse.json({ invitation: inv, inviteUrl, mode: "invitation" });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access || access.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const updated = await prisma.documentCollaborator.update({
    where: { id: parsed.data.collaboratorId, documentId: id },
    data: { role: parsed.data.role },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  return NextResponse.json({ collaborator: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const collaboratorId = searchParams.get("collaboratorId");
  const userId = searchParams.get("userId");

  const access = await getDocumentAccess(id, session.user.id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Owner can remove anyone; users can remove themselves
  if (access.role !== "OWNER" && userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (collaboratorId) {
    await prisma.documentCollaborator.delete({
      where: { id: collaboratorId, documentId: id },
    });
  } else if (userId) {
    await prisma.documentCollaborator.deleteMany({
      where: { documentId: id, userId },
    });
  }

  return NextResponse.json({ success: true });
}
