# Khalis Doodh — Verified Milk Delivery Across Punjab

**Live demo: https://khalis-doodh.onrender.com**

Khalis Doodh is a verification-first milk marketplace for Punjab, Pakistan. It connects households with local milk sellers (gwalas) they can trust: every gwala is CNIC-verified and approved by the admin before going live, every delivery is recorded in a shared monthly ledger (khata), and customers pay their gwala directly at month end — the platform never holds sale money.

## How it works

- **Customers (always free)** — browse verified gwalas in their area, subscribe to a daily milk plan, pause or skip days, follow the monthly khata entry by entry, and rate their gwala once every 30 days.
- **Gwalas** — enroll with CNIC and area proof, get approved, manage daily delivery stops, mark deliveries, sell dairy products (dahi, desi ghee, makhan, lassi and more) and track earnings from the khata.
- **Admin (hidden login)** — approves or rejects gwala enrollments, decides quality complaints, manages subscription fees and coverage areas, and can suspend or remove a gwala.

## Business model

- Customers never pay the platform anything.
- Platform income comes only from gwalas: a **base monthly subscription** plus an optional **product-listing subscription** (1-week or 1-month plans). Expired listing = products are unlisted automatically.
- **No commission** on any sale, **no wallet**, **no security deposit**. Milk money flows customer ↔ gwala directly against the shared khata record.
- Quality refunds are settled as a **khata deduction** decided by the admin: a single complaint is recorded, and a pattern of complaints from multiple households triggers deduction and warning. Top Rated badge at 4.5★ or above.

## Features

- Email + password accounts; customer and gwala accounts are separate by design; hidden admin login
- Monthly khata ledger — one entry per delivered delivery, product orders included, disputed amounts held out of the total until the admin decides
- Delivery scheduling with pauses, gwala route/stops view and earnings view
- 30-day rating rule with Top Rated / New badges
- Complaint system with pattern detection (3+ households in 7 days flags the gwala in the admin queue)
- English / Urdu interface with full RTL support
- AI support chat (Google Gemini) on the home and help pages, answering from the platform's own policies

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix), Wouter, TanStack React Query, Framer Motion, Recharts
- **Backend:** Node.js, Express, tRPC 11, Drizzle ORM with SQLite (better-sqlite3)
- **Auth:** email + password (scrypt hashing), JWT cookie sessions
- **AI:** Google Gemini (support chat + gwala document check assistance)

## Run locally

```bash
corepack prepare pnpm@10.4.1 --activate
corepack pnpm install --frozen-lockfile
corepack pnpm run build
npm start
```

Environment variables (set them in your hosting dashboard; never commit real values):

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Session token signing secret |
| `ADMIN_EMAIL` | Hidden admin account email |
| `ADMIN_PASSWORD` | Hidden admin account password |
| `GEMINI_API_KEY` / `GEMINI_KEY_1..3` | Optional — enables live AI chat answers |
| `KHALIS_DB_PATH` | Optional — SQLite file location (default `data/khalis-doodh.db`) |

## Deployment

Deployed on Render (free web service) from this repository via `render.yaml`. The build uses corepack to provide pnpm — Render's filesystem does not allow global npm installs.

## Project structure

```
client/          React frontend (pages, components, contexts)
server/          Express + tRPC backend (auth, marketplace, AI chat)
shared/          Shared types and constants
drizzle/         Database schema
docs/            Project report
```

---

Built by Hamza Madni — Pakpattan, Punjab, Pakistan.
