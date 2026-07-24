# Nexus Protocol

An AI-powered 3D escape room built with Next.js and React Three Fiber. You're trapped in the Nexus Dynamics facility after ARIA-7, the company's AI, locks the building down — explore six rooms, solve puzzles, talk to NPCs (powered by a real LLM), and reach one of several endings.

## Services used

| Service | What it's for | Local install needed? |
|---|---|---|
| **Neon PostgreSQL** | Hosted Postgres database — stores user accounts, game sessions, inventory, puzzle/NPC state, save slots. Accessed only via a connection string. | No — it's a managed cloud database. You just need a `DATABASE_URL` (from [neon.tech](https://neon.tech) or any Postgres-compatible host). |
| **Groq** (`groq-sdk`) | Powers the AI NPCs (ARIA-7, Dr. Chen, Marcus Webb, Director Price), in-game hints, and dynamic narrative text. Model: `llama-3.3-70b-versatile`. | No — it's an API. You need a free `GROQ_API_KEY` from [console.groq.com](https://console.groq.com). |
| **Prisma** | ORM/migration tool that talks to the Neon database. | Installed automatically via `npm install` (it's an npm dependency, not a separate service). |

There is no separate backend process — Next.js's own API routes (`src/app/api/**`) handle everything server-side, and the dev server (`npm run dev`) is the only thing you need to run locally.

## Requirements for expected functionality

- **Node.js** 20+ (LTS recommended; developed/tested on Node v24). Includes `npm`.
- **A modern browser with WebGL support** — the game renders a real-time 3D scene (React Three Fiber / Three.js) with shadows and post-processing (bloom). A recent Chrome, Edge, or Firefox with hardware acceleration enabled is recommended. Integrated GPUs work but a dedicated GPU will look/perform better.
- **A Neon (or other Postgres) database** and its connection string.
- **A Groq API key** (free tier is sufficient for development).
- **Git** — optional, but recommended for tracking changes (see "Restore points" below).

## Environment variables

Run `npm run setup` for an interactive prompt that writes `.env.local` for you
(it only asks for `DATABASE_URL` and `GROQ_API_KEY`, and derives/generates the
rest) — or copy `.env.example` to `.env.local` and fill in the values by hand:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon or compatible). If using Neon, use the **pooled** connection string (hostname contains `-pooler`) — the app's runtime queries go through it. |
| `DIRECT_URL` | Yes (if using Neon) | The **unpooled** connection string — Prisma migrations (`db:push`, `db:migrate`) need a direct connection, since PgBouncer's transaction-pooling mode doesn't support the prepared statements migrations use. Not needed for a plain (non-Neon) Postgres instance. |
| `JWT_SECRET` | Yes | Any long random string (32+ chars) — signs the auth session cookie. |
| `JWT_EXPIRES_IN` | No | Defaults are handled in code if omitted; example uses `7d`. |
| `GROQ_API_KEY` | Yes | From [console.groq.com](https://console.groq.com). Without this, NPC dialogue, hints, and dynamic narrative text will fail. |
| `NEXT_PUBLIC_APP_URL` | No | Used for building absolute URLs; `http://localhost:3000` for local dev. |
| `NODE_ENV` | No | Set automatically by Next.js scripts. |
| `AI_RATE_LIMIT_REQUESTS` | No | Defaults to `10` if unset. |
| `AI_RATE_LIMIT_WINDOW_MS` | No | Defaults to `60000` (1 minute) if unset. |

## Getting started

```bash
npm install          # install dependencies
npm run db:push       # sync the Prisma schema to your database
npm run dev            # start the dev server at http://localhost:3000
```

On Windows, you can skip all three commands above (and the environment
variable setup below) and just double-click **`start-nexus-protocol.bat`** in
this folder. On first run it installs dependencies, then asks you to paste in
your `DATABASE_URL` and `GROQ_API_KEY` (deriving `DIRECT_URL` and generating
`JWT_SECRET` for you), writes `.env.local`, runs `db:push`, and starts the dev
server and opens the game in your browser. Later runs just start the server
and open the browser. Cross-platform, `npm run setup` runs the same
interactive prompt on its own (Mac/Linux/manual use) if you'd rather not edit
`.env.local` by hand.

The **`Play Nexus Protocol`** shortcut (cyan hexagon icon) wraps that same
`.bat` file. Windows shortcuts store an absolute path, so a shortcut cloned
from GitHub still points at the original machine's folder and won't work
until it's repaired — `start-nexus-protocol.bat` does this automatically the
first time it runs. **So the first time, double-click `start-nexus-protocol.bat`
itself, not the shortcut**; after that, the shortcut will point at your own
clone and both work interchangeably.

## Other useful scripts

- `npm run build` / `npm run start` — production build and run.
- `npm run lint` — ESLint.
- `npm run db:studio` — Prisma Studio (browse/edit the database visually).
- `npm run db:migrate` — create/apply a Prisma migration (use instead of `db:push` once you want tracked migrations).

## Troubleshooting

**`terminating connection due to administrator command` (Postgres error `57P01`)**

This shows up in the Prisma logs when the underlying Postgres connection gets killed out
from under an in-flight query. On Neon specifically, this almost always means the compute
endpoint **auto-suspended** (Neon scales to zero after a period of inactivity on the free/dev
tier) or was restarted from the Neon console — it's not an application bug. It's most likely
to happen on a **direct** (non-pooled) connection, since those aren't designed to survive the
underlying compute cycling.

Fix: make sure `DATABASE_URL` points at Neon's **pooled** endpoint (hostname has `-pooler` in
it, from the Neon dashboard's "Pooled connection" toggle) with `?pgbouncer=true&connection_limit=1`,
and set `DIRECT_URL` to the unpooled connection string for migrations — see the Environment
variables table above. The pooler reconnects transparently across suspend/resume cycles instead
of handing your app a dead connection.

## Restore points

This project is tracked with git. If you want a rollback point before making changes, ask your assistant to commit one, or run:

```bash
git add -A && git commit -m "checkpoint"
```
