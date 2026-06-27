import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200).default("Untitled Document"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [owned, collaborated] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: userId },
      select: {
        id: true, title: true, updatedAt: true, createdAt: true, ownerId: true,
        owner: { select: { name: true, email: true, image: true } },
        _count: { select: { collaborators: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.documentCollaborator.findMany({
      where: { userId },
      include: {
        document: {
          select: {
            id: true, title: true, updatedAt: true, createdAt: true, ownerId: true,
            owner: { select: { name: true, email: true, image: true } },
            _count: { select: { collaborators: true } },
          },
        },
      },
      orderBy: { document: { updatedAt: "desc" } },
    }),
  ]);

  const ownedDocs = owned.map((d) => ({
    ...d,
    role: "OWNER" as const,
    collaboratorCount: d._count.collaborators,
    _count: undefined,
  }));

  const collabDocs = collaborated.map((c) => ({
    ...c.document,
    role: c.role,
    collaboratorCount: c.document._count.collaborators,
    _count: undefined,
  }));

  return NextResponse.json({ documents: [...ownedDocs, ...collabDocs] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const doc = await prisma.document.create({
      data: { title: parsed.data.title, ownerId: session.user.id },
      select: { id: true, title: true, createdAt: true },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
