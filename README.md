# Rowville Eagles FC website

Next.js + Payload CMS. See **ROADMAP.md** for the build plan.

```bash
npm install
cp .env.example .env      # set PAYLOAD_SECRET; PAYMENTS_SIMULATE=true to test checkout without Stripe
npm run seed              # sample content + admin user (admin@rowvilleeagles.local / change-me-now)
npm run dev               # site: http://localhost:3000  ·  admin: http://localhost:3000/admin
```

## Payments: two Stripe accounts

| Account | Receives |
|---|---|
| Rowville Eagles FC (club) | Team / season registrations |
| Rowville Foundation Academy | 1-on-1s, trials, Academy terms, holiday camps, tournaments, **all shop sales** |

Set up each account the same way:
1. Stripe Dashboard → Developers → API keys → copy the secret key into
   `STRIPE_SECRET_KEY_CLUB` / `STRIPE_SECRET_KEY_ACADEMY`.
2. Developers → Webhooks → add endpoint `https://<site>/stripe/webhook/club` (or `/academy`) with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET_CLUB` / `STRIPE_WEBHOOK_SECRET_ACADEMY`.
3. Use **test mode** keys first; switch to live keys at launch.

The account for each program is set automatically from its type (admin → Program → "Payments go to") and can be overridden.
