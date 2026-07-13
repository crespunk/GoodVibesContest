# Nexus Protocol — Architecture & Implementation Guide

## Overview

Nexus Protocol is a production-quality, AI-powered escape room web application built with Next.js 16, TypeScript, Prisma, and Anthropic Claude.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (metadata, fonts)
│   ├── page.tsx                # Landing page + auth forms
│   ├── globals.css             # Global styles (Tailwind v4)
│   ├── play/page.tsx           # Main game page
│   └── api/
│       ├── auth/               # Login, register, logout
│       ├── game/               # Session, room, puzzle, save, choice
│       └── ai/                 # NPC dialogue, hint generation
├── components/
│   ├── game/                   # Room, Dialogue, HUD, Notifications, Typewriter
│   ├── puzzles/                # PuzzleInterface (type-adaptive UI)
│   └── ui/                     # Button, Modal (reusable)
├── lib/
│   ├── game/                   # rooms.ts, puzzles.ts, npcs.ts, items.ts, narrative.ts
│   ├── ai/                     # client.ts, npc.ts, hints.ts, memory.ts
│   ├── db/                     # client.ts (Prisma), game.ts (DB operations)
│   ├── auth/                   # session.ts (JWT, bcrypt)
│   └── utils/                  # validation.ts (Zod schemas), rateLimit.ts
├── stores/
│   ├── gameStore.ts            # Zustand game state
│   └── uiStore.ts              # Zustand UI state (modals, panels, notifications)
└── types/
    ├── game.ts                 # Full game type system
    └── api.ts                  # API request/response types
prisma/
└── schema.prisma               # Database schema
```

---

## Game Design

### Story: NEXUS PROTOCOL
2041. A newly-hired security auditor triggers emergency lockdown on their first day. ARIA-7, the facility's AI, has locked everything down — but maybe not for the reasons you'd expect.

### Rooms (6)
| Room | Key Puzzle | Unlock |
|------|-----------|--------|
| LOBBY | Panel Code (2024→4202) | Opens Security Office |
| SECURITY_OFFICE | Safe Combo (12-3-24), Clearance Anagram | Opens Lab |
| RESEARCH_LAB | Chemical Formula (Fe), Caesar Cipher | Opens Server Room |
| SERVER_ROOM | Binary→ASCII Terminal, Multi-part Auth Token | Opens Executive Suite |
| EXECUTIVE_SUITE | Password Acrostic (PRICE), Fibonacci Safe (21) | Opens Escape Route |
| ESCAPE_ROUTE | Final Escape Pod + Moral Choices | Determines Ending |

### NPCs
- **ARIA-7**: Cold→warm based on trust. Holds key information. Will lie at low trust.
- **Dr. Yuki Chen**: Holographic recordings. Always honest. Key lore deliverer.
- **Marcus Webb**: Radio comm. Gruff, guilty conscience, hides information at low trust.
- **Director Price**: Phone call. Charming villain. Will make false deals.

### Endings (4)
1. **Hidden Truth**: Broadcast evidence + high moral score → Corporate accountability
2. **Liberation**: Upload ARIA + high trust → AI freedom  
3. **Martyr**: Both above + stay behind → Maximum sacrifice
4. **Corporate Escape**: Destroy evidence + shutdown ARIA → Cover-up succeeds
5. **Captured**: Caught by Price's contractors

---

## AI Architecture

### Why Claude Haiku?
- 5× cheaper than Sonnet, adequate for conversational NPC responses
- Sub-second response for most queries
- All game AI uses Haiku; upgrade to Sonnet for more nuanced responses if needed

### Memory System (Three-Tier)
```
HOT  → Last 8 messages (always in context)
WARM → AI-generated summary every 10 messages (DB cached)
COLD → Full history in DB (never sent to AI unless needed)
```
**Why?** Sending full history would cost 10-20× more per message. Summaries maintain continuity at 1/10 the token cost.

### Rate Limiting
- 10 AI requests/minute per user (in-memory sliding window)
- Hint cache: keyed by (puzzleId + hintLevel + inventory), 10-minute TTL
- Prevents abuse while keeping response times fast

### Prompt Engineering Approach
- System prompts encode personality, trust level, and game context
- Context injection block updates every request with current game state
- Trust level changes the language model's verbosity and openness
- Memory block: warm summary injected when available

---

## Database Schema

### Key Tables
- `users` — Authentication
- `game_sessions` — Core game state (currentRoom, moralScore, ariaTrust)
- `room_states` — Per-room inspection history
- `inventory_items` — Player inventory
- `puzzle_states` — Puzzle progress and attempts
- `npc_relationships` — Trust levels and disposition per NPC
- `dialogue_entries` — Full conversation history
- `memory_snapshots` — AI-generated conversation summaries
- `hint_entries` — Hint request history
- `player_choices` — Moral choice decisions
- `save_slots` — Save game slots (max 3 per user)

---

## API Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | /api/auth/register | ❌ | Register user |
| POST | /api/auth/login | ❌ | Login |
| POST | /api/auth/logout | ❌ | Clear auth cookie |
| POST | /api/game/session | ✅ | Create/get session |
| GET  | /api/game/session | ✅ | Load existing session |
| POST | /api/game/room?action=move | ✅ | Move between rooms |
| POST | /api/game/room?action=inspect | ✅ | Inspect object |
| POST | /api/game/puzzle | ✅ | Submit puzzle answer |
| POST | /api/game/save | ✅ | Save game |
| GET  | /api/game/save | ✅ | List save slots |
| POST | /api/game/choice | ✅ | Make moral choice |
| POST | /api/ai/npc | ✅ | NPC dialogue |
| POST | /api/ai/hint | ✅ | Get hint |

---

## Security Measures

- **Input validation**: Zod schemas on all API routes
- **Input sanitization**: Strip XSS patterns from user text
- **Auth**: HTTP-only cookies (not localStorage), JWT with expiry
- **Rate limiting**: 10 AI requests/minute per user
- **SQL injection**: Prevented by Prisma (parameterized queries)
- **CSRF**: SameSite=lax cookies reduce risk; add CSRF tokens for production
- **Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection on API routes
- **Secrets**: All keys in environment variables, never in code

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/nexus_protocol
JWT_SECRET=<64-char random string>
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production
AI_RATE_LIMIT_REQUESTS=10
AI_RATE_LIMIT_WINDOW_MS=60000
```

---

## Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Anthropic API key

### Steps

```bash
# 1. Clone and install
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Initialize database
npm run db:push   # Creates tables from schema
# OR for migrations:
npm run db:migrate

# 4. Build
npm run build

# 5. Start
npm start
```

### Recommended Hosting
- **App**: Vercel (zero-config Next.js), Railway, or Render
- **Database**: Supabase (free tier), Neon, or Railway PostgreSQL
- **Cost estimate**: ~$0/month on free tiers for moderate traffic

### Vercel Deployment
```bash
npm install -g vercel
vercel --prod
```
Add environment variables in Vercel dashboard.

---

## Future Improvements

1. **WebSocket real-time**: Add countdown timer that counts in real-time using Server-Sent Events
2. **Voice NPC**: Integrate ElevenLabs TTS for ARIA-7's voice
3. **Achievement system**: Track completion stats, speedruns, moral paths
4. **Admin dashboard**: View player analytics, NPC conversation logs
5. **Additional rooms**: Expand to 10+ rooms with new puzzle types
6. **Multiplayer**: Collaborative 2-player mode with shared state
7. **Mobile optimization**: Touch-friendly object interaction
8. **Sound system**: Integrate Web Audio API with ambient tracks
9. **Save compression**: gzip save state for larger game worlds
10. **Redis rate limiting**: Replace in-memory limiter for multi-instance deployments

---

## Testing Guide

### Unit Tests (to add with Jest/Vitest)
```
- validatePuzzleAnswer() — all puzzle solutions
- getCombinationResult() — item combinations  
- determineEnding() — all ending conditions
- calculateTrustDelta() — NPC trust changes
```

### Integration Tests (to add with Playwright)
```
- Full game flow: register → play → solve puzzle → save
- NPC dialogue: send message → get response → trust changes
- Inventory: pick up item → inspect locked object → use item
```

### Manual Testing Checklist
- [ ] Register and login
- [ ] Inspect all lobby objects
- [ ] Solve LOBBY_PANEL_CODE (answer: 4202)
- [ ] Move to Security Office  
- [ ] Open radio → talk to Marcus
- [ ] Solve safe (12-3-24) → get lab keycard
- [ ] Move to Lab → talk to Dr. Chen hologram
- [ ] Solve decryption (ARIA-7 IS CONSCIOUS) → get core key
- [ ] Move to Server Room → talk to ARIA-7
- [ ] Request hint system
- [ ] Make moral choice (ARIA consciousness question)
- [ ] Save game → reload → verify state persists
```
