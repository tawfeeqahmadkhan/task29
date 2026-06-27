# CollabDocs — Local-First Collaborative Document Editor

> House of EdTech · Fullstack Developer Assignment 2 (v2.1, April 2026)

**Live Demo:** [collabdocs.vercel.app](https://collabdocs.vercel.app)  
**Repository:** [github.com/tawfeeqpathan3/collabdocs](https://github.com/tawfeeqpathan3/collabdocs)  
**Author:** [Tawfeeq Pathan](https://github.com/tawfeeqpathan3) · [LinkedIn](https://linkedin.com/in/tawfeeqpathan3)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [Local-First Design](#3-local-first-design)
4. [CRDT Conflict Resolution](#4-crdt-conflict-resolution)
5. [Background Sync Engine](#5-background-sync-engine)
6. [Real-Time Collaboration (SSE)](#6-real-time-collaboration-sse)
7. [Version History & Time Travel](#7-version-history--time-travel)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Document Sharing System](#9-document-sharing-system)
10. [AI Features](#10-ai-features)
11. [Security Architecture](#11-security-architecture)
12. [Database Schema](#12-database-schema)
13. [API Reference](#13-api-reference)
14. [Setup & Deployment](#14-setup--deployment)
15. [Offline Sync Flow (Detailed)](#15-offline-sync-flow-detailed)
16. [Design Decisions & Trade-offs](#16-design-decisions--trade-offs)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                        │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────────┐ │
│  │  Tiptap      │   │  Y.Doc       │   │  SyncEngine         │ │
│  │  Editor UI   │◄──│  (In-Memory  │◄──│  (Offline Queue     │ │
│  │  (React)     │   │   CRDT)      │   │   localStorage)     │ │
│  └──────────────┘   └──────┬───────┘   └──────────┬──────────┘ │
│                             │                       │            │
│                    ┌────────▼────────┐              │            │
│                    │  y-indexeddb    │              │            │
│                    │  (IndexedDB     │              │            │
│                    │  persistence)   │              │            │
│                    └─────────────────┘              │            │
└─────────────────────────────────────────────────────┼────────────┘
                                                       │ HTTP/SSE
┌─────────────────────────────────────────────────────┼────────────┐
│                     Next.js Server                   │            │
│                                                      │            │
│  ┌─────────────────┐  ┌─────────────┐  ┌───────────▼──────────┐ │
│  │  NextAuth.js    │  │  AI Routes  │  │  Sync API            │ │
│  │  (JWT sessions) │  │  (Groq LLM) │  │  POST /sync          │ │
│  └─────────────────┘  └─────────────┘  │  GET  /sync (pull)   │ │
│                                         │  GET  /sse  (push)   │ │
│  ┌──────────────────────────────────────┴──────────────────┐   │ │
│  │                     Prisma ORM (v7)                      │   │ │
│  └──────────────────────────────────────────────────────────┘   │ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                         ┌──────────▼──────────┐
                         │     PostgreSQL        │
                         │  (Neon / Supabase)   │
                         └──────────────────────┘
```

**Primary principle:** The browser is the source of truth during editing. The server is the reconciliation point when connectivity is available.

---

## 2. Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Framework | Next.js 15 (App Router) | SSR, API routes, file-based routing, Vercel deployment |
| Language | TypeScript 5 | End-to-end type safety |
| Editor | Tiptap v2 | Headless ProseMirror with Yjs collaboration plugin |
| CRDT | Yjs | Industry-standard CRDT for rich text; compatible with Tiptap |
| Local Storage | y-indexeddb | Yjs ↔ IndexedDB bridge for offline persistence |
| Real-Time | Server-Sent Events (SSE) | No WebSocket infra needed; works on Vercel Edge |
| Auth | NextAuth.js v5 (Auth.js) | JWT + Credentials provider; PrismaAdapter |
| Database | PostgreSQL + Prisma 7 | Relational integrity; Prisma adapter pattern |
| AI | Vercel AI SDK + Groq | Ultra-fast Llama 3 inference; streaming-ready |
| Styling | Tailwind CSS v4 + Radix UI | Utility-first; accessible component primitives |
| Validation | Zod | Schema validation on every API boundary |

---

## 3. Local-First Design

### How it works

```
User types → Y.Doc updates in-memory → y-indexeddb auto-saves to IndexedDB
                                      → SyncEngine debounces (2s) → HTTP POST to /sync
```

The application has **zero blocking network calls** during editing:

1. **Tiptap editor** binds to a `Y.Doc` instance via `@tiptap/extension-collaboration`
2. **y-indexeddb** provider automatically persists every Y.js update to IndexedDB
3. On page load, the editor first hydrates from **IndexedDB** (instant, no network)
4. Then **merges** the server's Y.js binary state (CRDT merge — safe, never destructive)

**Result:** The document is editable offline immediately on load, and stays editable if connectivity drops.

### Y.Doc lifecycle per document

```
On mount:
  1. new Y.Doc()
  2. new IndexeddbPersistence(`doc-${id}`, ydoc)  → hydrate from local storage
  3. persistence.on("synced") → applyUpdate(ydoc, serverYjsState)  → CRDT merge
  4. editor binds to ydoc

On every keystroke:
  - ydoc mutates → y-indexeddb persists asynchronously (non-blocking)
  - SyncEngine.enqueue() called (debounced 2s)

On debounce fire (online):
  - SyncEngine.flush() → POST /api/documents/{id}/sync

On debounce fire (offline):
  - Payload saved to localStorage queue
  - Flushed on next "online" event
```

---

## 4. CRDT Conflict Resolution

### Why Yjs?

Yjs implements a **CRDT (Conflict-free Replicated Data Type)** optimized for rich text. Unlike OT (Operational Transformation), Yjs:

- **Does not require a central server** to sequence operations
- **Merges concurrently** — offline edits from two users always resolve deterministically
- **Never destroys data** — both users' text is always preserved in a deterministic order

### Merge algorithm

```
User A (offline):  "Hello World"  →  "Hello Brave World"
User B (online):   "Hello World"  →  "Hello Beautiful World"

After sync:  "Hello Brave Beautiful World"  (both insertions preserved)
```

The server stores the **full Y.js state** as a binary blob (`Bytes` in PostgreSQL). On sync:

```typescript
// Server-side merge (sync/route.ts)
const serverDoc = new Y.Doc();
if (existingState) Y.applyUpdate(serverDoc, existingState);
Y.applyUpdate(serverDoc, incomingUpdate);        // CRDT merge
const merged = Y.encodeStateAsUpdate(serverDoc); // New canonical state
```

This is **associative, commutative, and idempotent** — applying the same update twice is safe.

### Conflict scenarios handled

| Scenario | Result |
|----------|--------|
| Two users type in different positions | Both insertions preserved |
| Same position concurrent insert | Deterministic ordering by peer ID |
| Network partition + reconnect | Full merge on first sync, no data loss |
| Long offline period (days) | Update accumulated, merged on reconnect |
| Server state ahead of client | Client pulls via GET /sync, merges locally |

---

## 5. Background Sync Engine

**File:** `src/lib/sync/SyncEngine.ts`

### Queue design

The sync engine uses `localStorage` as a persistent queue, so pending syncs survive page refreshes:

```
localStorage["docsync_queue"] = [
  { documentId, title, yjsUpdate (base64), timestamp, retries }
]
```

### Deduplication

Only the **latest update** per document is kept in the queue:
```typescript
this.queue = this.queue.filter((q) => q.documentId !== documentId);
this.queue.push({ documentId, title, yjsUpdate, ... });
```

### Retry with backoff

| Retry | Delay |
|-------|-------|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |
| 4 | 16s |
| 5 | 30s |

After 5 retries, the item is dropped (5xx errors are retried; 4xx errors are permanent failures).

### Trigger points

| Event | Action |
|-------|--------|
| 2s after last keystroke | `enqueue()` + `flush()` if online |
| `online` browser event | `flush()` + `pullAndMerge()` |
| Page mount (if online) | `flush()` (drains localStorage queue) |

---

## 6. Real-Time Collaboration (SSE)

**File:** `src/app/api/documents/[id]/sse/route.ts`

Since Vercel doesn't support persistent WebSocket connections, we use **Server-Sent Events**:

```
Client connects: GET /api/documents/{id}/sse
Server polls DB every 3s, sends "update" event if updatedAt changed
Client receives event → Y.applyUpdate(ydoc, serverYjsState)
Heartbeat every 25s to keep connection alive through proxies
```

### Why not WebSockets?

- SSE works natively on Vercel/Netlify without custom server
- Stateless — each SSE connection independently polls the DB
- Good enough for document editing (3s latency acceptable vs. milliseconds for gaming)
- For sub-second latency, upgrade path: replace with PartyKit or Liveblocks

### Viewer protection

The SSE route is read-only. Viewers receive document updates but **cannot** call `POST /sync`. This is enforced at the API layer with role checks.

---

## 7. Version History & Time Travel

### Snapshot model

Snapshots capture the **full Y.js binary state** at a point in time:
```
DocumentVersion { yjsState: Bytes, title, description, createdBy, createdAt }
```

### Creating a snapshot

```
POST /api/documents/{id}/versions
→ Reads current document.yjsState
→ Creates DocumentVersion with that binary state
→ Returns version metadata
```

### Restoring a snapshot (safe time-travel)

The restore operation **preserves other collaborators' ongoing work**:

```
POST /api/documents/{id}/versions/{versionId}/restore

1. Save current state as "[Pre-restore] <title>" snapshot
2. Load restored Y.js state into a fresh Y.Doc
3. Apply as a new Y.js update (CRDT semantics preserved)
4. Persist updated state to document
5. Return new Y.js state to client → applyUpdate(ydoc, restoredState)
```

**Why this is safe:** Other active collaborators receive the restored state via SSE and their Y.js docs merge it — there is no data corruption or "last write wins" overwrite.

---

## 8. Authentication & Authorization

### Authentication flow

```
Register: POST /api/auth/register → bcrypt hash → User record
Login:    signIn("credentials") → bcrypt.compare → JWT token
Session:  JWT stored in httpOnly cookie (NextAuth managed)
```

### Authorization model

| Role | Read | Write | Share | Delete |
|------|------|-------|-------|--------|
| OWNER | ✅ | ✅ | ✅ | ✅ |
| EDITOR | ✅ | ✅ | ❌ | ❌ |
| VIEWER | ✅ | ❌ | ❌ | ❌ |

Every API route checks role via `getDocumentAccess()`:
```typescript
const access = await getDocumentAccess(documentId, userId);
if (!access) return 404;
if (!canEdit(access.role)) return 403;
```

`canEdit()` returns `true` only for OWNER and EDITOR. **Viewers hitting the sync endpoint receive HTTP 403.**

---

## 9. Document Sharing System

### Direct share (user exists)

```
POST /api/documents/{id}/share { email, role }
→ User found in DB? → Upsert DocumentCollaborator immediately
→ User gets access on next page load
```

### Invitation link (user not registered)

```
→ User NOT found? → Create ShareInvitation { token, email, role, expiresAt }
→ Return invite URL: /invite/{token}
→ User registers → visits /invite/{token} → POST /api/invite/{token}
→ Adds as DocumentCollaborator, marks invitation accepted
```

Invitations expire in 7 days and are single-use.

---

## 10. AI Features

**Provider:** Groq — ultra-fast inference via Llama 3.1 8B Instant  
**SDK:** Vercel AI SDK (`ai` package + `@ai-sdk/groq`)

### Summarize (document-level)
- **Full Summary** — 2-3 paragraph prose summary
- **Key Points** — Bulleted list of 5 main ideas
- **TL;DR** — Single sentence summary

### Improve (selection-level)
- **Fix Grammar** — Corrects spelling and grammar, returns corrected text
- **Rephrase** — Improves clarity and flow
- **Expand** — Adds detail and context
- **Shorten** — Compresses while preserving message

### AI security
- Request payload limited to 50KB (summarize) / 5KB (improve)
- Groq API key is server-side only (never exposed to client)
- Rate limiting via content-length checks

---

## 11. Security Architecture

### Payload size limiting

Every sync endpoint checks `Content-Length` before parsing:
```typescript
if (contentLength > MAX_PAYLOAD_SIZE) return 413; // 5MB hard limit
```

This prevents **OOM attacks** where a malicious actor sends a 2GB Y.js payload.

### Y.js update validation

Every incoming Y.js update is verified by applying it to a throwaway doc:
```typescript
const testDoc = new Y.Doc();
Y.applyUpdate(testDoc, updateBytes); // throws on malformed input
testDoc.destroy();
```

This catches malformed/crafted binary that could crash the Yjs library.

### Input validation with Zod

All API routes parse input through Zod schemas before touching the database:
```typescript
const parsed = syncSchema.safeParse(body);
if (!parsed.success) return 400;
```

Prevents injection attacks, type coercion exploits, and unexpected field access.

### Row-Level Security equivalent (ORM scoping)

Prisma queries are always scoped to the authenticated user:
```typescript
// Always passes userId to getDocumentAccess before any DB operation
const access = await getDocumentAccess(documentId, session.user.id);
if (!access) return 404; // Tenant isolation — user can't see other users' docs
```

Even if an attacker guesses a document ID, they receive 404 unless they have access.

### Role enforcement at multiple layers

1. **API route layer** — `canEdit(role)` check before mutation
2. **Database layer** — Prisma `where` clause includes ownership/collaboration check
3. **UI layer** — Editor is set to `editable: false` for viewers (defense in depth)

### Additional mitigations

| Attack | Mitigation |
|--------|-----------|
| OOM via large Y.js payload | 5MB Content-Length limit + base64 length check in Zod |
| Malformed Y.js crashing server | Y.applyUpdate validation in temp doc |
| SQL injection | Prisma parameterized queries |
| XSS via document content | Tiptap sanitizes HTML; Content-Security-Policy header |
| CSRF | NextAuth CSRF tokens on mutation endpoints |
| Brute force login | bcrypt cost factor 12; add rate limiting in production |

---

## 12. Database Schema

```
User ─────┬──< Account (OAuth)
          ├──< Session
          ├──< Document (owned)
          ├──< DocumentCollaborator
          ├──< DocumentVersion (created by)
          └──< SyncEvent

Document ─┬──< DocumentCollaborator >── User
          ├──< DocumentVersion
          ├──< ShareInvitation
          └──< SyncEvent
```

Key design decisions:
- `Document.yjsState: Bytes` — raw binary Y.js state, not JSON (performance)
- `Document.textContent: Text` — plain text extraction for search indexing
- `SyncEvent` — audit log for detecting abuse patterns
- `ShareInvitation.token: String @unique` — unguessable CUID, single-use

---

## 13. API Reference

### Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/documents` | Required | List user's documents |
| POST | `/api/documents` | Required | Create new document |
| GET | `/api/documents/{id}` | Required | Get document + collaborators |
| PATCH | `/api/documents/{id}` | Editor+ | Update title |
| DELETE | `/api/documents/{id}` | Owner | Delete document |

### Sync

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/documents/{id}/sync` | Editor+ | Push Y.js update |
| GET | `/api/documents/{id}/sync` | Any | Pull current Y.js state |
| GET | `/api/documents/{id}/sse` | Any | SSE stream for real-time updates |

### Versions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/documents/{id}/versions` | Any | List versions |
| POST | `/api/documents/{id}/versions` | Editor+ | Create snapshot |
| POST | `/api/documents/{id}/versions/{vId}/restore` | Editor+ | Restore version |

### Sharing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/documents/{id}/share` | Owner | Invite collaborator |
| PATCH | `/api/documents/{id}/share` | Owner | Change role |
| DELETE | `/api/documents/{id}/share?collaboratorId=` | Owner | Remove collaborator |

### Invitations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/invite/{token}` | Public | Preview invitation |
| POST | `/api/invite/{token}` | Required | Accept invitation |

### AI

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ai/summarize` | Required | Summarize document |
| POST | `/api/ai/improve` | Required | Improve selected text |

---

## 14. Setup & Deployment

### Local development

```bash
# 1. Clone repository
git clone https://github.com/tawfeeqpathan3/collabdocs
cd collabdocs

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL, AUTH_SECRET, GROQ_API_KEY

# 4. Push database schema
npx prisma migrate dev

# 5. Start dev server
npm run dev
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | Random 32+ char secret for NextAuth JWT |
| `NEXTAUTH_URL` | ✅ | App URL (e.g., `http://localhost:3000`) |
| `GROQ_API_KEY` | Optional | Groq API key (AI features disabled without it) |

### Recommended PostgreSQL providers

- **Neon** — free tier, serverless PostgreSQL, works great with Vercel
- **Supabase** — free tier, includes Auth and realtime if needed
- **Railway** — simple setup, free trial

### Vercel deployment

```bash
# Push to GitHub, then:
# 1. Connect repo to Vercel
# 2. Add environment variables in Vercel dashboard
# 3. Deploy — automatic on every push to main
```

### CI/CD

The project uses Vercel's built-in CI/CD:
- Every push to `main` → automatic production deployment
- Pull requests → preview deployments
- Type checking via `tsc --noEmit` (add to `vercel.json` build command)

---

## 15. Offline Sync Flow (Detailed)

```
T=0:   User opens document /documents/abc123
       → Page renders (SSR loads initial Yjs state from DB)
       → IndexeddbPersistence hydrates Y.Doc from local cache (instant)
       → Server state merged into Y.Doc via Y.applyUpdate (CRDT, safe)
       → EventSource opens to /api/documents/abc123/sse

T=5:   User loses WiFi (goes offline)
       → navigator.onLine = false
       → NetworkStatusIndicator shows "Offline" (amber)

T=10:  User edits document extensively
       → Y.Doc updates in-memory
       → y-indexeddb saves to IndexedDB automatically
       → SyncEngine.enqueue() called, payload saved to localStorage
       → No network requests attempted

T=30:  User regains WiFi
       → "online" event fires
       → SyncEngine.flush() drains localStorage queue:
           POST /api/documents/abc123/sync { yjsUpdate: "...", title: "..." }
       → Server merges with any remote changes (CRDT)
       → Server responds with updated full Y.js state
       → Client applies server state: Y.applyUpdate(ydoc, serverState)
       → NetworkStatusIndicator shows "Saved" (green)

T=31:  SSE stream reconnects automatically
       → Any changes from other collaborators during offline period stream in
       → Y.Doc merges them (CRDT — no conflicts possible)
```

---

## 16. Design Decisions & Trade-offs

### Decision: Yjs over OT (Operational Transformation)

**Why:** Yjs doesn't require a central server to order operations. OT requires every operation to flow through a single authoritative server — making offline mode impossible without complex queueing. Yjs CRDTs merge in any order, in any topology.

**Trade-off:** Y.js state grows over time (it tracks tombstones for deleted characters). Mitigation: periodic state compaction (`Y.encodeStateAsUpdateV2` with compression) and version pruning.

### Decision: SSE over WebSocket

**Why:** Vercel's Edge Runtime doesn't support long-lived TCP connections. SSE is a unidirectional HTTP stream that works natively. Client-to-server writes use regular HTTP POST.

**Trade-off:** 3-second polling latency vs. millisecond WebSocket latency. Acceptable for document editing; upgrade path is PartyKit/Liveblocks for real-time cursors.

### Decision: Full Y.js state storage (not delta log)

**Why:** Storing the full merged state means we can reconstruct the current document with a single DB read. Delta logs require replaying history.

**Trade-off:** Larger blob per document. Mitigation: compress with `zstd` at the DB level; cap document size at client validation.

### Decision: IndexedDB over localStorage for offline content

**Why:** localStorage is synchronous and has a 5-10MB limit. IndexedDB is async, can store arbitrary binary data (Y.js uses binary encoding), and has no practical size limit.

### Decision: HTTP polling SSE vs. database triggers

**Why:** PostgreSQL LISTEN/NOTIFY with a persistent connection is more efficient but complicates deployment (requires a persistent server process, not serverless functions).

**Trade-off:** Each SSE connection polls every 3s. At 10 active users = 10 queries/3s. Mitigated by caching at the database query layer and upgrading to LISTEN/NOTIFY when scaling past 100 concurrent users.

### Decision: 5MB sync payload cap

**Why:** Without a limit, a malicious actor could POST a 2GB payload causing OOM and crashing the Node.js process. 5MB accommodates very large documents (~3M words in Y.js binary).

---

## File Structure

```
src/
├── app/
│   ├── page.tsx                    Landing page
│   ├── login/page.tsx              Authentication
│   ├── register/page.tsx           Registration
│   ├── dashboard/
│   │   ├── page.tsx                Server Component (data fetch)
│   │   └── DashboardClient.tsx     Interactive dashboard
│   ├── documents/[id]/page.tsx     Document editor page
│   ├── invite/[token]/             Invitation accept flow
│   └── api/
│       ├── auth/                   NextAuth handlers + register
│       ├── documents/              CRUD + sync + SSE + versions + share
│       ├── invite/                 Invitation accept
│       └── ai/                     Summarize + improve
├── components/
│   ├── editor/
│   │   ├── CollaborativeEditor.tsx Main editor component
│   │   ├── EditorToolbar.tsx       Formatting toolbar
│   │   ├── NetworkStatusIndicator.tsx Offline/syncing/online pill
│   │   ├── VersionHistory.tsx      Sidebar for versions
│   │   └── AISidebar.tsx           AI assistant sidebar
│   ├── dashboard/
│   │   ├── DocumentCard.tsx        Document grid card
│   │   └── ShareDialog.tsx         Share management modal
│   └── ui/                         Radix UI + CVA primitives
├── lib/
│   ├── auth.ts                     NextAuth configuration
│   ├── db.ts                       Prisma client singleton
│   ├── document-access.ts          Role-based access helper
│   ├── utils.ts                    Shared utilities + constants
│   └── sync/SyncEngine.ts          Offline sync queue
├── hooks/
│   └── useNetworkStatus.ts         Online/offline detection
└── types/index.ts                  Shared TypeScript types
```

---

*CollabDocs demonstrates mastery of distributed systems challenges: browser-based memory management (Yjs CRDT binary state + IndexedDB), state synchronization race conditions (debounced queue + CRDT merge), and complex data merging algorithms (Y.js update/state encoding over HTTP).*
