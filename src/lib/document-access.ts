import { prisma } from "./db";
import type { Role } from "@prisma/client";

type FetchedDoc = NonNullable<Awaited<ReturnType<typeof fetchDoc>>>;

export interface DocumentAccess {
  role: Role;
  document: FetchedDoc;
}

export async function getDocumentAccess(
  documentId: string,
  userId: string
): Promise<DocumentAccess | null> {
  const document = await fetchDoc(documentId);
  if (!document) return null;

  if (document.ownerId === userId) {
    return { role: "OWNER", document };
  }

  const collab = document.collaborators.find((c) => c.userId === userId);
  if (collab) {
    return { role: collab.role, document };
  }

  return null;
}

async function fetchDoc(documentId: string) {
  return prisma.document.findUnique({
    where: { id: documentId },
    include: {
      collaborators: { select: { userId: true, role: true } },
      owner: { select: { name: true, email: true, image: true } },
    },
  });
}

export function canEdit(role: Role): boolean {
  return role === "OWNER" || role === "EDITOR";
}
