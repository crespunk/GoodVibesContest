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

Copy `.env.example` to `.env.local` and fill in the values:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (Neon or compatible). |
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

On Windows, you can also just double-click **`Play Nexus Protocol`** (the shortcut with the cyan hexagon icon) in this folder — it starts the dev server if it isn't already running and opens the game in your browser once it's ready. That shortcut just wraps `start-nexus-protocol.bat`, kept alongside it.

## Other useful scripts

- `npm run build` / `npm run start` — production build and run.
- `npm run lint` — ESLint.
- `npm run db:studio` — Prisma Studio (browse/edit the database visually).
- `npm run db:migrate` — create/apply a Prisma migration (use instead of `db:push` once you want tracked migrations).

## Restore points

This project is tracked with git. If you want a rollback point before making changes, ask your assistant to commit one, or run:

```bash
git add -A && git commit -m "checkpoint"
```
