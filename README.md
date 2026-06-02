# AzaPay — Marketing Website

A self-contained, responsive marketing site for **AzaPay**, a digital banking and
AI-credit platform for unbanked and underbanked Nigerians.

> 📓 **Full build history, architecture, feature internals, and decisions:**
> see [PROJECT_LOG.md](PROJECT_LOG.md).

## Run it

No build step required. Either:

- **Double-click `index.html`**, or
- Serve the folder (better, so relative paths and fonts behave like production):

```powershell
# From this folder, with Python installed:
python -m http.server 8000
# then open http://localhost:8000
```

## Files

Multi-page static site — each menu item is its own page, with a shared header/footer.

| File | Page | Contents |
|---|---|---|
| `index.html` | Home | Hero, stats, the problem, value proposition, "explore" grid, CTA |
| `product.html` | Product | The six core features (wallet, savings, AI underwriting, Trust Score, lending, insights) |
| `trust-score.html` | Trust Score | 300–850 gauge, the six weighted signals, how scores move |
| `credit.html` | Credit | The 5-product loan ladder + fairness principles (`#principles`) |
| `how-it-works.html` | How it works | 5-step onboarding, the 3 KYC tiers, inclusion, payment rails |
| `about.html` | About | Vision / mission / goal + compliance & privacy (`#compliance`) |
| `waitlist.html` | Join the waitlist | The email signup form |
| `sandbox.html` | Sandbox | Interactive Stripe test-mode simulation (loan → disburse → top-up) |
| `styles.css` | — | Brand design system (emerald + gold), layout, responsive rules, animations |
| `script.js` | — | Sticky/mobile nav, scroll-reveal, animated counters, Trust Score gauge, waitlist form |
| `sandbox.js` | — | Sandbox logic: loan-approval/disbursement simulation + Stripe top-up |
| `api/create-checkout-session.js` | — | Serverless: creates a Stripe **test-mode** Checkout Session (secret key server-side) |
| `api/checkout-session.js` | — | Serverless: verifies a session on return from Stripe |
| `assets/og-cover.png` | — | 1200×630 social-share image |

The shared `<header>`/`<footer>` markup is duplicated in each page (static site, no templating).
The current page is highlighted in the nav via `aria-current="page"`. To change navigation
globally, edit the nav block in each `*.html` file.

## Notes

- **No backend.** The waitlist form validates client-side and stores entries in
  `localStorage` as a friendly confirmation. Wire it to an email/CRM endpoint for production.
- **Fonts** load from Google Fonts with system-font fallbacks if offline.
- **Accessibility:** semantic landmarks, skip link, keyboard-operable nav, `aria-live`
  form status, visible focus rings, and `prefers-reduced-motion` support.
- **Content honesty:** figures (loan terms, score weights) are illustrative per the product
  brief; the footer carries a regulatory disclaimer. Validate with local counsel and a
  licensed banking partner before launch.

## Before launch (placeholders to replace)

The site passed a multi-dimension review; a few items are deliberately left as launch-time TODOs:

- **Live URL.** Deployed at <https://azapay-website.vercel.app>. Canonical, `og:url`,
  `og:image`, `twitter:image`, and the JSON-LD URLs all point at this Vercel URL. When you
  add a custom domain, replace `azapay-website.vercel.app` everywhere in `<head>`.
- **Waitlist.** Point the form at a real email/CRM endpoint (currently client-side only).

## Payments sandbox (Stripe test mode)

The **Sandbox** page (`sandbox.html`) simulates **AzaPay Bridge** — cash-flow bridge financing:

1. **Get a Bridge advance** — pick a trade, enter monthly cash flow, and the limit is the lesser
   of a cash-flow cap (50%) and a Trust-Score tier. Pricing is shown as an APR, with a **2% discount
   for AzaPay-account holders** (the "Save 2% APR" toggle). Pure front-end simulation.
2. **Funded same day** — credits the simulated wallet balance (a live build would use Stripe
   Connect transfers/payouts).
3. **Add money to wallet** — a **real Stripe test-mode Checkout** via the serverless functions.

Bridge features mirror the AzaPay Bridge concept (approval in minutes, no payslips/tax returns,
same-day funding, save 2% APR). US-specific claims from that concept (FDIC, SOC 2, W-2) are
deliberately omitted/adapted to AzaPay's Nigeria compliance framing (NDPA), and no fabricated
traction/testimonials are shown.

Steps 1 & 2 work with no configuration. Step 3 needs a Stripe **test** secret key.

### Enable the Stripe step

1. Create a free account at <https://dashboard.stripe.com/register> (test mode works
   immediately — no business activation required).
2. With **Test mode** on, copy your secret key (`sk_test_…`) from **Developers → API keys**.
3. Add it to the Vercel project and redeploy:
   ```bash
   vercel env add STRIPE_SECRET_KEY production   # paste the sk_test_… key when prompted
   vercel --prod
   ```
   (Add it to `preview`/`development` too if you use `vercel dev`.)
4. On the Sandbox page, run step 3 with test card **4242 4242 4242 4242**, any future
   expiry, any CVC.

Notes:
- The secret key lives **only** in `STRIPE_SECRET_KEY` (server-side); it is never sent to
  the browser. The functions refuse live keys (`sk_live_…`) so the sandbox can't move real money.
- No npm dependency — the functions call Stripe's REST API with `fetch`.
- Currency defaults to **NGN**. If your test account rejects NGN, set `CURRENCY = 'usd'`
  at the top of `api/create-checkout-session.js`.

## Deployment

- **GitHub:** <https://github.com/karmic05/azapay-website> (push to `main`).
- **Vercel:** linked to the GitHub repo — every push to `main` auto-deploys to production.
  Manual deploy: `vercel --prod` from this folder. The `/api/*.js` files deploy as
  serverless functions automatically (no config needed).

## Customise

- Brand colours live in the `:root` block at the top of `styles.css`.
- Copy is plain HTML in the per-page `*.html` files.
- The social-share card can be regenerated by re-running the OG image script (System.Drawing).
