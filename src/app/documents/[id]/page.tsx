import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDocumentAccess } from "@/lib/document-access";
import { prisma } from "@/lib/db";
import CollaborativeEditor from "@/components/editor/CollaborativeEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const access = await getDocumentAccess(id, session.user.id);
  if (!access) notFound();

  const { role } = access;

  const collaborators = await prisma.documentCollaborator.findMany({
    where: { documentId: id },
    include: { user: { select: { name: true, email: true, image: true } } },
  });

  type CollaboratorRow = (typeof collaborators)[number];

  const doc = access.document;
  return (
    <CollaborativeEditor
      documentId={doc.id}
      initialTitle={doc.title}
      initialYjsState={doc.yjsState ? Buffer.from(doc.yjsState).toString("base64") : null}
      role={role}
      collaborators={collaborators.map((c: CollaboratorRow) => ({
        id: c.id,
        userId: c.userId,
        role: c.role,
        user: c.user,
      }))}
    />
  );
}
