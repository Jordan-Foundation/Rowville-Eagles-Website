# Rowville Eagles FC — Build Roadmap

## ✅ Phase 1 — Foundation (done)
- Next.js 16 + Payload CMS 3 in one codebase (`/` public site, `/admin` committee CMS)
- Design system with two brands: **Club** (`:root`) and **Foundation Academy** (`[data-brand="academy"]`) — `src/app/(frontend)/styles.css`
- Data model built for payments + portal: Users (roles), Participants (players owned by parents),
  Teams, Programs (registrations, camps, tournaments, Academy terms/trials, 1-on-1s), Bookings, News, Sponsors, Site settings
- Pages: Home, Foundation Academy, Camps & Programs (+ detail), Teams, News (+ article), Fixtures

## ✅ Phase 2a — Brand (done)
- Club crest + colours (royal blue #1D4888, gold #F1CB22, red #CA272C) — `public/brand/`, `styles.css`
- RFA sub-brand: monochrome black / grey / white / gloss black, RFA wordmark + Foundation triangle (vector redraws in `src/components/Logos.tsx`)
- Ground (208 Dandelion Drive, Rowville), email, Facebook, Instagram
- Two Stripe accounts: `Program.payee` (registrations → club, everything else → academy) — `src/lib/stripe-accounts.ts`

## ⏳ Phase 2b — Content (needs club input)
- [ ] Original vector logo files (SVG/AI/PDF) to replace the redraws
- [ ] Real photos, sponsor logos, real program prices/dates, team training times
- [ ] Migrate content from the current GoDaddy site; set up 301 redirects from old URLs

## Phase 3 — Payments & bookings (Stripe)
- [ ] Stripe Checkout for every Program; webhook creates paid `Bookings`
- [ ] Season registration: pay club fee here → redirect + reminder to complete FV section in PlayFootball
- [ ] Capacity limits, waitlists, sibling discounts, early-bird pricing, promo codes, refunds
- [ ] 1-on-1 / trial slot booking (coach availability → bookable time slots)
- [ ] Email receipts & reminders (Resend)

## Phase 4 — Online store
- [ ] Products with size variants (uniforms, training wear, merch), Stripe checkout, pick-up / postage
- [ ] Order management in admin

## Phase 5 — Fixtures integration
- [ ] Confirm Dribl data access with Football Victoria / Dribl; per-team fixtures & results via `Teams.driblTeamId`

## Phase 6 — Member & player development portal
- [ ] Parent/player login, manage participants, view **calendar of all bookings** (camps, sessions, Academy, matches)
- [ ] Coach view: squad lists, attendance, assessments, development goals
- [ ] Child Safe: role-based access, consent records, audit log, WWCC tracking

## Phase 7 — AI administration (Claude)
- [ ] Draft news/match reports/newsletters from notes; registration FAQ assistant; coach-facing player progress summaries
- [ ] Human approval before anything is published or sent

## Launch (go live)
- Host: Vercel · DB: Postgres (Neon) · Media: S3/R2 · Domain: keep at GoDaddy, point DNS to Vercel
- ⚠ Check whether club email runs through GoDaddy before changing DNS (MX records must be preserved)
