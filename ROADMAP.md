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

## ✅ Phase 3 — Payments, bookings & shop (built — awaiting Stripe keys)
- Booking flow for every program: `/programs/[slug]/book` → Stripe Checkout → `/checkout/success`
  - Player, emergency contact, medical, photo consent, terms; tournaments take a team entry instead
  - Time-slot picking for 1-on-1s and trials (`Program.slots`), per-slot and per-program capacity
  - Season registrations show the "complete FV in PlayFootball" step after payment
- Shop: `/shop`, product pages with sizes & stock, cart, pickup or flat-rate postage
- **Two Stripe accounts:** registrations → Club; camps, tournaments, Academy, 1-on-1s and **all shop sales** → Academy
- Webhooks per account (`/stripe/webhook/club`, `/stripe/webhook/academy`); payment also verified on the success page
- Unpaid places are held 35 min, then released (Stripe session expiry)

### Still to do in payments
- [ ] Branded confirmation & reminder emails (Resend) — Stripe sends receipts meanwhile
- [ ] Waitlists, sibling discounts, early-bird pricing, promo codes, instalments
- [ ] Refunds from admin; order "ready for pickup" emails

## ✅ Phase 3b — Trials, offers, accounts & member shop
- "Join us for <season>" funnel (`/join`): DOB → FV age group → pick a club trial night, or register interest
- Publishing a club trial date emails everyone waiting in those age groups with a pick-a-night link
- Committee sets a trial registration to "Offer a place" (team + registration) → account created + offer email
- Team registration payable only from the family's account for an offered player
- RFA trials (`/academy/trial`) from the current term's weekly nights, limited spots per age group per night
- Player tags: paid registration → Rowville; paid Academy term → RFA (editable for players registered elsewhere)
- Shop shows supporter gear to all, team kit to Rowville families, RFA gear to RFA families (enforced at checkout)
- Login / account / set-password; every confirmed booking emails a create-account link
- Fixtures page = team news feed (posts tagged with teams); sitemap, robots, club structured data

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
