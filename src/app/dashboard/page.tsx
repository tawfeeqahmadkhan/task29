import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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

  const documents = [
    ...owned.map((d) => ({ ...d, role: "OWNER" as const, collaboratorCount: d._count.collaborators, updatedAt: d.updatedAt.toISOString(), createdAt: d.createdAt.toISOString(), _count: undefined })),
    ...collaborated.map((c) => ({ ...c.document, role: c.role, collaboratorCount: c.document._count.collaborators, updatedAt: c.document.updatedAt.toISOString(), createdAt: c.document.createdAt.toISOString(), _count: undefined })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <DashboardClient
      user={{ name: session.user.name ?? null, email: session.user.email!, image: session.user.image ?? null }}
      initialDocuments={documents}
    />
  );
}
