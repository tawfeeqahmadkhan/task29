import type { Role } from "@prisma/client";

export type { Role };

export interface DocumentMeta {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  ownerId: string;
  owner: { name: string | null; email: string; image: string | null };
  role: Role;
  collaboratorCount: number;
}

export interface CollaboratorInfo {
  id: string;
  userId: string;
  role: Role;
  user: { name: string | null; email: string; image: string | null };
}

export interface VersionMeta {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  createdBy: { name: string | null; email: string; image: string | null };
}

export interface SyncPayload {
  documentId: string;
  title: string;
  yjsUpdate: string; // base64 encoded Uint8Array
  clientTimestamp: number;
}

export interface SyncResponse {
  serverTimestamp: number;
  yjsState: string | null; // base64 encoded full state
  title: string;
}

export type NetworkStatus = "online" | "offline" | "syncing" | "error";

export interface PendingSyncItem {
  documentId: string;
  title: string;
  yjsUpdate: string;
  timestamp: number;
  retries: number;
}
