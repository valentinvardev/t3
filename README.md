# Noted

A real-time collaborative workspace built with the T3 Stack. Includes notes, a shared checklist, a global chat with live presence, and an in-app economy powered by a coinflip game.

---

## Features

### Notes
- Create, search, and delete personal notes
- Full-text search across title and content
- Share any note directly to the global chat (rate-limited: 1 per 2 minutes)

### Checklist
- Personal task list with optimistic toggle (instant UI feedback, rollback on error)
- Clear all completed items in one action

### Global Chat
- Real-time-like chat via incremental polling (1.5 s interval — only fetches new messages)
- Live user presence (online indicator based on heartbeat, 60 s threshold)
- Note-sharing bubbles rendered inline in the chat

### Coinflip Economy
- Every user starts with **1,000 points**
- Start a coinflip game from the chat: pick a side (Heads / Tails) and a bet amount (10 – 10,000 pts)
- Any other user can join the open game — the result is decided server-side
- Animated coin flip sequence visible to both players simultaneously (synced via `resolvedAt` timestamp)
- Balance update is delayed until after the animation reveals the result
- Floating `+X` / `−X` badge on the balance display when points change

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router) |
| Language | TypeScript 5 |
| API | [tRPC 11](https://trpc.io) + React Query 5 |
| Database ORM | [Prisma 6](https://prisma.io) |
| Database | PostgreSQL via [Supabase](https://supabase.com) |
| Auth | [NextAuth v5](https://authjs.dev) (credentials + JWT) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com) |
| Icons | [Lucide React](https://lucide.dev) |
| Deployment | [Vercel](https://vercel.com) |

---

## Project Structure

```
src/
├── app/
│   ├── (app)/               # Authenticated app shell
│   │   ├── notes/           # Notes page
│   │   └── checklist/       # Checklist page
│   └── (auth)/              # Auth pages (sign in / sign up)
├── components/
│   ├── chat-bar.tsx         # Global chat panel + coinflip UI
│   ├── sidebar.tsx          # Navigation sidebar + balance badge
│   └── app-shell.tsx        # Layout wrapper
└── server/
    ├── auth/                # NextAuth config
    ├── db.ts                # Prisma client singleton
    ├── actions/
    │   └── register.ts      # Registration server action (bcrypt)
    └── api/
        ├── root.ts          # tRPC router root
        └── routers/
            ├── users.ts     # me · getAll · heartbeat
            ├── messages.ts  # getRecent (incremental) · send
            ├── notes.ts     # getAll · create · delete
            ├── checklist.ts # getAll · create · toggle · delete · clearCompleted
            └── coinflip.ts  # create · join · cancel
prisma/
└── schema.prisma            # Database schema
```

---

## Data Model

```
User          — id, name, email, password (bcrypt), points (default 1000), lastSeen
Message       — content, sharedNoteTitle?, sharedNoteContent?, coinflipGameId? (unique)
CoinflipGame  — bet, status (WAITING|FINISHED|CANCELLED), creatorSide, result?,
                winnerId?, resolvedAt?, creator, joiner
Note          — title, content, userId
ChecklistItem — label, done, userId
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Supabase recommended)

### Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd t3
npm install

# 2. Configure environment
cp .env.example .env
# Fill in the values (see section below)

# 3. Push schema to database
npm run db:push

# 4. Start dev server
npm run dev
```

### Environment Variables

```env
# Required
AUTH_SECRET=         # Random secret — generate with: npx auth secret
DATABASE_URL=        # Supabase pooler connection string  (port 6543)
DIRECT_URL=          # Supabase direct connection string  (port 5432)

# Optional
NODE_ENV=development
```

> **Supabase note:** `DATABASE_URL` should use the connection pooler (port 6543) for runtime queries. `DIRECT_URL` should use the direct connection (port 5432) for Prisma migrations (`db:push` / `db:generate`).

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:push` | Sync Prisma schema → database (no migration history) |
| `npm run db:generate` | Create a new migration |
| `npm run db:migrate` | Apply pending migrations (CI / production) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run typecheck` | Run TypeScript type checker |

---

## API Reference

All procedures require authentication (`protectedProcedure`) unless noted.

### `users`
| Procedure | Type | Description |
|---|---|---|
| `me` | query | Current user's id, name, email, points |
| `getAll` | query | All users with lastSeen (for presence display) |
| `heartbeat` | mutation | Update lastSeen to now |

### `messages`
| Procedure | Type | Description |
|---|---|---|
| `getRecent` | query | Last 50 messages on initial load; only new ones when `since: Date` is passed |
| `send` | mutation | Send a text message or share a note (rate-limited) |

### `notes`
| Procedure | Type | Description |
|---|---|---|
| `getAll` | query | All notes belonging to current user |
| `create` | mutation | Create a note with title + content |
| `delete` | mutation | Delete a note (ownership enforced via `userId` filter) |

### `checklist`
| Procedure | Type | Description |
|---|---|---|
| `getAll` | query | All checklist items for current user |
| `create` | mutation | Add a new item |
| `toggle` | mutation | Set done/undone (ownership enforced) |
| `delete` | mutation | Remove an item (ownership enforced) |
| `clearCompleted` | mutation | Delete all completed items |

### `coinflip`
| Procedure | Type | Description |
|---|---|---|
| `create` | mutation | Create an open game (deducts bet atomically; rate-limited 1/10 s) |
| `join` | mutation | Join and resolve a game (atomic double-join protection) |
| `cancel` | mutation | Cancel own open game and refund bet |

---

## Security

- Passwords hashed with **bcrypt** (cost factor 12)
- All API routes protected via `protectedProcedure` — JWT session verified on every request
- Ownership enforced with `userId` in `where` clause on all write operations
- Coinflip balance deductions use `updateMany(where: points >= bet)` inside a transaction — prevents negative balances and TOCTOU races
- Double-join race prevented by atomically claiming the game with `updateMany(where: status = WAITING)`
- Rate limits: chat messages (1/2 s), note shares (1/2 min), game creation (1/10 s)
- `sharedNoteContent` capped at 20,000 chars; `sharedNoteTitle` capped at 200 chars

---

## Deployment (Vercel)

1. Push to GitHub — Vercel deploys automatically on every push to `main`
2. Set `AUTH_SECRET`, `DATABASE_URL`, and `DIRECT_URL` in the Vercel project dashboard
3. The Prisma client is generated automatically via the `postinstall` script
4. `outputFileTracingIncludes` in `next.config.js` ensures the generated Prisma client is bundled correctly for Vercel's serverless functions
