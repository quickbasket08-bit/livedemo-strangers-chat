# Strangers — Text & Video Chat MVP

A username-only, Omegle-style random chat app: pick a username, choose Text
or Video, get matched with a stranger, chat, click Next for someone new.

**Stack:** Next.js 14 (App Router, TypeScript) · Supabase (Postgres +
Realtime, matchmaking logic lives in SQL functions) · LiveKit Cloud (video) ·
Tailwind CSS · Vercel (hosting).

This README takes you from an empty folder to a live, working URL. Follow it
top to bottom — nothing is skipped.

---

## 0. What you're getting — architecture in one picture

```
Browser
 │
 ├─ / .................. username form → POST /api/session (signed cookie, no password)
 ├─ /mode ............... choose Text or Video → POST /api/matchmaking/join, then
 │                        polls GET /api/matchmaking/poll every 1.5s until matched
 ├─ /chat/text/[roomId] . Supabase Realtime *broadcast* channel `room:<id>` for
 │                        live messages; POST /api/messages to send + persist
 └─ /chat/video/[roomId]  POST /api/livekit-token → <LiveKitRoom> from
                          @livekit/components-react handles the actual video call

Server (Next.js API routes, service_role key — browser never touches the DB directly)
 │
 ├─ join_queue() / find_match() / leave_queue() / end_room()   ← Postgres functions,
 │                                                                 the actual matchmaker
 └─ tables: queue, rooms, messages, reports, blocks             ← Supabase/Postgres
```

Why it's built this way, in short: the browser's Supabase "anon" key is only
ever used for realtime broadcast (pure pub/sub, no table access needed). Every
database read/write happens in a Next.js API route using the Supabase
`service_role` key, and all five tables have Row Level Security turned on
with zero policies — so even if the anon key leaked, it couldn't read or
write anything. Matchmaking itself is a single SQL function (`find_match`)
using `FOR UPDATE SKIP LOCKED`, so two people clicking "Text chat" at the same
moment can't both grab the same partner.

### File map

```
omegle-clone/
├── supabase/migrations/0001_init.sql   ← run this once in Supabase
├── src/app/
│   ├── page.tsx                       ← username entry
│   ├── mode/page.tsx                  ← choose text/video, waiting room
│   ├── chat/text/[roomId]/page.tsx
│   ├── chat/video/[roomId]/page.tsx
│   ├── terms/page.tsx, privacy/page.tsx   ← TEMPLATES, replace before real launch
│   └── api/
│       ├── session/route.ts           ← sets the username cookie
│       ├── matchmaking/{join,poll,next,leave}/route.ts
│       ├── messages/route.ts          ← send + persist + broadcast a text message
│       ├── livekit-token/route.ts     ← mints a short-lived LiveKit JWT
│       └── report/route.ts            ← report + optional block
├── src/components/                    ← UsernameForm, ModeSelector, TextChatRoom,
│                                          VideoChatRoom, ReportButton
└── src/lib/                           ← session.ts (cookie signing), supabaseServer.ts
                                           (service_role), supabaseClient.ts (anon)
```

---

## 1. Prerequisites

Install once, on your own machine:

- [Node.js 18.18+](https://nodejs.org) (`node -v` to check)
- Git
- A free [GitHub](https://github.com) account
- A free [Supabase](https://supabase.com) account
- A free [LiveKit Cloud](https://cloud.livekit.io) account (has a generous free tier)
- A free [Vercel](https://vercel.com) account

---

## 2. Get the code running

```bash
cd omegle-clone
npm install
cp .env.example .env.local
```

You'll fill in `.env.local` in the next three steps. Leave the terminal open.

---

## 3. Create the Supabase project + database

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   Pick any name/region/password (the DB password isn't used by this app directly).
2. Wait ~2 minutes for it to provision.
3. Go to **Project Settings → API**. Copy three values into `.env.local`:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ secret — never put this
     behind `NEXT_PUBLIC_`, never commit it, never send it in a browser request)
4. Go to **SQL Editor → New query**, paste the entire contents of
   `supabase/migrations/0001_init.sql`, and click **Run**. This creates the
   `queue`, `rooms`, `messages`, `reports`, `blocks` tables and the
   `join_queue` / `find_match` / `leave_queue` / `end_room` functions.
5. Go to **Database → Replication** and confirm Realtime is enabled for the
   project (it is by default). You don't need to enable it per-table — this
   app only uses Realtime *broadcast*, not table-change subscriptions.

---

## 4. Create the LiveKit Cloud project

1. Go to [cloud.livekit.io](https://cloud.livekit.io) → create a project.
2. On the project's **Settings** page, copy:
   - `WebSocket URL` (looks like `wss://your-project.livekit.cloud`) →
     `NEXT_PUBLIC_LIVEKIT_URL`
   - `API Key` → `LIVEKIT_API_KEY`
   - `API Secret` → `LIVEKIT_API_SECRET`

---

## 5. Generate the session secret

This signs the username-only cookie so it can't be forged client-side.

```bash
openssl rand -hex 32
```

Paste the output into `.env.local` as `SESSION_SECRET`.

At this point `.env.local` should have all 6 values filled in (7 including
`NODE_ENV`, which you don't set manually).

---

## 6. Run it locally

```bash
npm run dev
```

Open **two different browser windows** (or one normal + one Incognito, so
they get different cookies) to `http://localhost:3000`:

1. In window A: pick a username → **Text chat**.
2. In window B: pick a different username → **Text chat**.
3. Within ~1-2 seconds both should land in the same chat room. Send messages
   both directions. Click **Next** in one window — it should return to
   matchmaking and the other window should show "disconnected."
4. Repeat with **Video chat** instead — you should see/hear both camera feeds
   (allow camera/mic permissions when prompted).

If matching doesn't happen, check your terminal for errors first — almost
always a missing/incorrect env var. See **Troubleshooting** below.

---

## 7. Push to GitHub

```bash
git init
git add -A
git commit -m "Initial commit: strangers chat MVP"
gh repo create strangers-chat --private --source=. --push
```

(No `gh` CLI? Create an empty repo on github.com, then `git remote add origin <url>`
and `git push -u origin main`.)

---

## 8. Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → import the GitHub repo you
   just pushed.
2. Framework preset: Next.js (auto-detected). Leave build settings default.
3. Before clicking Deploy, open **Environment Variables** and add all 6 keys
   from your `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`,
   `SESSION_SECRET`).
4. Click **Deploy**. In ~1-2 minutes you'll get a live URL like
   `https://strangers-chat.vercel.app`.
5. Repeat the two-browser-window test from Step 6 against the live URL —
   ideally from two different physical devices/networks, since that's the
   real-world case WebRTC (used by LiveKit) needs to handle NAT traversal
   for.

**You're live.** This is the "Two browsers can enter usernames, pick a mode,
get matched, chat, click Next" milestone from the original plan — done for
both text and video.

---

## 9. Before you actually announce this publicly

This app connects anonymous strangers over live video with no ID
verification — treat the safety/legal items below as required, not optional
polish:

- **Replace `src/app/terms/page.tsx` and `src/app/privacy/page.tsx`.**
  They're clearly-marked placeholders. Get real Terms of Use and a Privacy
  Policy reviewed by a lawyer before public launch — this is not legal
  advice.
- **CSAM/minor-safety obligations are real and legally binding**, not just
  "nice to have," for any US-based platform that transmits images/video
  between users. If you operate in or serve users in the US, research your
  obligations under 18 U.S.C. § 2258A (reporting apparent CSAM to NCMEC) and
  look into providers like Thorn/Safer or hash-matching APIs for image
  moderation before opening this to the public. The 18+ checkbox and "appears
  to be a minor" report reason in this codebase are a start, not a complete
  solution.
- **Moderation is currently manual.** Reports land in the `reports` table
  with no dashboard yet — query them directly in the Supabase Table Editor,
  or build a simple internal `/admin` page that reads from it. Do this before
  you have real traffic, not after.
- **Rate limiting in `/api/messages` is in-memory** (resets on every cold
  start/redeploy, and doesn't share state across serverless instances). For
  real abuse resistance, swap it for
  [Upstash Redis](https://upstash.com) + [`@upstash/ratelimit`](https://github.com/upstash/ratelimit), which
  works well with Vercel's serverless functions.
- **Stale queue entries**: if someone closes the tab while waiting, their
  `queue` row is cleaned up via a `beforeunload` beacon call in this app, but
  that isn't 100% reliable (killed processes, lost network). Schedule the
  provided `purge_stale_queue(30)` SQL function to run every ~30 seconds using
  [Supabase Cron](https://supabase.com/docs/guides/database/extensions/pg_cron) or a
  [Vercel Cron Job](https://vercel.com/docs/cron-jobs) that calls a small
  `/api/cron/purge-queue` route you add.
- **LiveKit Cloud's free tier** has monthly connection-minute limits — check
  current pricing before assuming a launch is "free" at scale.

---

## 10. Known limitations / good next steps

- Matchmaking is poll-based (client asks every 1.5s), which is simple and
  reliable at MVP scale but not the most efficient at high concurrency —
  Supabase Realtime `postgres_changes` on the `rooms` table, or a small
  WebSocket layer, is the natural upgrade once you have real usage.
- No reconnect-into-the-same-room support if a user's browser tab crashes —
  `ended_at` gets set and they'd need to click Text/Video again.
- No presence/typing indicators, image sharing, or persistent friend/history
  features — deliberately, per the original scope (those are v2 territory).

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Missing NEXT_PUBLIC_SUPABASE_URL..." error | `.env.local` not filled in / dev server not restarted after editing it |
| Stuck on "Finding a stranger…" forever with 2 windows open | Migration SQL wasn't run, or the two windows share the same cookie (use Incognito for the 2nd one) |
| Video connects but no camera image | Browser blocked camera permission — check the address bar's permission icon |
| Works locally, fails on Vercel | An env var wasn't added in the Vercel dashboard, or `NEXT_PUBLIC_LIVEKIT_URL` doesn't start with `wss://` |
| "Not a participant in this room" | Cookie from a previous session is stale — clear cookies for the site and start over |
