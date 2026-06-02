# AzaPay — Project Log & Reference

A build history and working reference for the **AzaPay** marketing website + interactive
sandbox. It captures, in order, every change made across the build conversation, the
current architecture, how each feature works, and the decisions behind them. For the
short operational guide (run/deploy/files), see [README.md](README.md).

---

## At a glance

| | |
|---|---|
| **Live site** | https://azapay-website.vercel.app |
| **GitHub** | https://github.com/karmic05/azapay-website (public) |
| **Vercel project** | `azapay-website` (auto-deploys on push to `main`) |
| **Stack** | Static multi-page HTML/CSS/JS + two zero-dependency Vercel serverless functions (Stripe). No build step. |
| **Brand** | Emerald (`#07502F`/`#0E7C4A`) + gold (`#F4B740`); Plus Jakarta Sans (headings) + Inter (body) |

## What AzaPay is

A product concept: a digital banking and AI-powered credit platform for **unbanked and
underbanked Nigerians** — secure payments, savings, and fair credit built from a
**Financial Trust Score** (real behaviour, not banking history). Slogan: *"Banking the
Unbanked."* The site is a pre-launch marketing site plus an interactive **AzaPay Bridge**
sandbox that simulates the product flow.

---

## Site map / files

| File | Page / role | Contents |
|---|---|---|
| `index.html` | Home | Hero (animated phone mockup), stats, the problem, value prop, "explore the platform" grid, CTA |
| `product.html` | Product | 6 core features (wallet, savings, AI underwriting, Trust Score, lending, insights) |
| `trust-score.html` | Trust Score | Animated 300–850 gauge, the 6 weighted signals, how scores move |
| `credit.html` | Credit | 5-product loan ladder (nano → SME) + fairness principles (`#principles`) |
| `how-it-works.html` | How it works | 5-step BVN/NIN onboarding, 3 KYC tiers, inclusion, payment rails |
| `about.html` | About | Vision / mission / goal + compliance & privacy (`#compliance`) |
| `waitlist.html` | Join the waitlist | Multi-field signup form + simulated account-approval modal |
| `sandbox.html` | Sandbox | **AzaPay Bridge** interactive simulation (gated behind approval) |
| `api/create-checkout-session.js` | Serverless | Creates a Stripe **test-mode** Checkout Session (secret key server-side) |
| `api/checkout-session.js` | Serverless | Verifies a Checkout Session on return from Stripe |
| `styles.css` | — | Brand design system, layout, responsive rules, animations |
| `script.js` | — | Sticky/mobile nav, scroll-reveal, counters, Trust Score gauge, waitlist form + approval modal |
| `sandbox.js` | — | The Bridge calculator + disbursement + Stripe top-up + gate unlock |
| `assets/og-cover.png` | — | 1200×630 social-share image (generated) |
| `README.md` | — | Short operational guide |
| `PROJECT_LOG.md` | — | This document |

The shared `<header>`/`<footer>` markup is **duplicated in each page** (static site, no
templating). The current page is highlighted in the nav via `aria-current="page"`. To
change navigation globally, edit the nav block in each `*.html`.

---

## Build log (chronological)

### 1. Initial build — the marketing site
- Built a self-contained, responsive marketing site from the product brief: hero, stats,
  the problem, 6 features, the Financial Trust Score (animated gauge + 6 weighted signals),
  the 5-product credit ladder, KYC onboarding + payment rails, value prop, compliance &
  privacy, vision/mission, waitlist, footer with a regulatory disclaimer.
- Brand: emerald + gold; Plus Jakarta Sans / Inter; soft shadows; scroll-reveal animations;
  animated counters; working mobile menu; `prefers-reduced-motion` support.
- Generated a branded 1200×630 OG social image (`assets/og-cover.png`) via PowerShell
  `System.Drawing`.
- **Adversarial review** (6 dimensions): 43 raw findings → **21 confirmed and fixed**
  (loans-grid layout, mobile-nav focus, contrast/AA, heading hierarchy, SEO/meta, etc.).
- Deliberately avoided fabricating user/traction numbers (pre-launch).

### 2. Deploy to GitHub + Vercel
- Created the public repo `karmic05/azapay-website`, pushed `main`.
- Deployed to Vercel production; the GitHub repo was auto-connected → **push to `main`
  auto-deploys**.
- Updated `canonical` / `og:url` / `og:image` / JSON-LD to the live URL.

### 3. Single-page → multi-page
- Split the one-page site into a page per menu item (Product, Trust Score, Credit, How it
  works, About, Join the waitlist) with a shared shell, active-link highlighting, and
  per-page SEO. Home gained the "explore the platform" grid linking to each page.
- **Review**: 19 raw → **14 confirmed/fixed** (per-page heading hierarchy, the waitlist
  CTA's active state, the credit grid's centered bottom row, decorative-glyph `aria-hidden`,
  dead-CSS cleanup).

### 4. Stripe test-mode sandbox
- Added a **Sandbox** page + two zero-dependency Vercel serverless functions that call
  Stripe's REST API via `fetch` (no `stripe` npm package, no build step). Secret key stays
  server-side in `STRIPE_SECRET_KEY`.
- Simulated flow: loan approval → disbursement (client-side) → **add money to wallet via a
  real Stripe test-mode Checkout**.
- **Security-focused review**: 20 raw → **11 confirmed/fixed** (double-credit window, a
  re-disburse loop, chip `aria-pressed`, GET method guard, pinned `Stripe-Version`, stronger
  control borders, state sanitisation). Security dimension confirmed **no secret-key leakage**.
- Shipped with a graceful `503 stripe_not_configured` (no key yet) and an in-page setup panel.

### 5. AzaPay Bridge features (from `azapay-bridge-magic.lovable.app`)
- Reframed the sandbox as **AzaPay Bridge** — cash-flow bridge financing: a trade selector,
  a monthly cash-flow input, a **"Save 2% APR" AzaPay-account toggle**, same-day funding
  framing, a Bridge feature strip, and a bank-level-security line.
- **Honesty adaptation:** dropped/adapted the source's US-specific claims (FDIC, SOC 2, W-2)
  to AzaPay's Nigeria framing (NDPA), and **omitted the fabricated "1,200+ pros" count and
  named testimonial** so nothing dishonest ships.
- **Review**: 13 raw → **7 confirmed/fixed**, incl. a **site-wide** focus-ring bug (gold ring
  was invisible on light backgrounds) → replaced with a dual-tone ring visible on light *and*
  dark; corrected a too-light control-border token; decline-path announcements.

### 6. Made the Bridge step live & calculative
- The approval result was frozen on click (typing a new amount left a stale "Approved" value).
  Rebuilt Step 1 as a **live calculator**: the offer recomputes on every change to trade,
  cash flow, Trust Score, amount, and the APR toggle.
- **Approval = 85% of the requested amount**, flexed by occupation and Trust Score (see
  formula below), capped by a cash-flow/score ceiling.
- **State made ephemeral** (in-memory, no `localStorage`) so a page refresh fully resets the
  flow and the Disburse button.

### 7. Stripe key configured — live test payments
- Ran `vercel env add STRIPE_SECRET_KEY production` + `vercel --prod`.
- Caught that piping the key via stdin appended a **trailing newline** ("Value contains
  newlines") → hardened the handlers to **`.trim()`** the key (valid `Authorization` header
  regardless of stored whitespace).
- Verified live: `create-checkout-session` returns a real `checkout.stripe.com/...` test
  session; **NGN is accepted** by the test account.

### 8. Removed the Stripe setup panel
- The "Enable live test payments" `<details>` panel was pre-setup scaffolding; redundant once
  the key was connected. Removed it (kept a JS-required `<noscript>` note), deleted its dead
  CSS, and dropped the stale `#setup` reference in JS. Setup steps remain in `README.md`.

### 9. Explore cards "unclickable"
- Investigated: the six Home "explore" cards were **already** clickable `<a>` links to the
  existing pages (all returning 200). Surfaced this with verification rather than creating
  duplicate pages; likely cause of the report was a cached older copy → hard refresh.

### 10. Gated the sandbox behind account approval
- Flow: **Join the waitlist → faded approval modal (reviewing → approved) → redirect to the
  sandbox → unlock.**
- The sandbox is **locked by default**: `#sbxBody` is blurred + `inert`, with a `.sbx-gate`
  lock card and a "Join the waitlist to unlock" CTA. Approval sets `sessionStorage`
  `azapay_approved`; a pre-paint `<head>` script adds `html.sbx-unlocked` (no flash) and
  `sandbox.js` removes `inert`.
- `sessionStorage` → stays unlocked across refresh, **re-locks on a new tab/session** (handy
  for re-demoing).

### 11. Full waitlist signup fields
- Expanded the form from email-only to **full name, email, mobile number, age, ID number
  (11-digit BVN/NIN), city, and ZIP/postal code** in a responsive 2-column grid.
- Native constraint validation (`checkValidity()`/`reportValidity()`): age **18+**, ID
  **`\d{11}`**, valid email/phone, all required.
- **Privacy-safe:** only the email is kept in `localStorage`; the sensitive KYC fields are
  never stored. Microcopy notes it's a demo.

---

## How key features work

### Financial Trust Score (marketing)
A 300–850 scale built from weighted behavioural signals — Repayment 35%, Cash-flow 20%,
Savings 15%, Bills 15%, Transaction depth 10%, Verification 5%. Animated gauge on
`trust-score.html`.

### Sandbox — AzaPay Bridge (`sandbox.html` + `sandbox.js`)
Three steps, all live/calculative:

1. **Get a Bridge advance** — cash-flow approval, no payslips/tax returns. Inputs: trade,
   monthly cash flow, Trust Score, requested amount, "Save 2% APR" toggle.
2. **Funded same day** — credits the simulated wallet (a live build would use Stripe Connect
   transfers/payouts).
3. **Add money to wallet** — a real Stripe **test-mode** Checkout.

**Key formulas (illustrative, test-mode only):**
```
scoreTier(score):  <480→20k, <600→75k, <680→150k, <760→300k, else 500k   (NGN)
ceiling (limit) = min(scoreTier(score), monthlyCashFlow × 0.5)
approvalRate = clamp(85 + occDelta + round((score − 700) / 15), 55, 95)   (%)
  occDelta: electrician +3, plumber +2, mechanic 0, carpenter −1, trader −4, other −6
approved = min( requested × approvalRate/100 , limit )   // "counter-offer" if capped
APR = 24% base, 22% with an AzaPay account (−2%)
fee (30-day term) = approved × APR/100 × 30/365 ;  total = approved + fee
```
**State is ephemeral** (in-memory) — refresh resets the flow and Disburse button.

### Account-approval gate
- `waitlist.html` form submit → `script.js` `runApproval()` shows a faded modal
  (`#approveModal`): "Reviewing your activity…" → "You're approved!" → sets
  `sessionStorage.azapay_approved = "1"` → redirects to `sandbox.html`.
- `sandbox.html` `<head>` runs a tiny pre-paint script: if approved, add `sbx-unlocked` to
  `<html>` (CSS hides the gate + unblurs). `sandbox.js` removes `inert` from `#sbxBody`.
- Locked default = `#sbxBody` has `inert` + `filter: blur(5px)`; `.sbx-gate` overlay covers
  the section.

### Stripe integration (security model)
- **Secret key only server-side** in `STRIPE_SECRET_KEY`; never sent to the browser. Handlers
  `.trim()` the key and **reject live keys** (`sk_live_…`) so the sandbox can't move real money.
- No npm dependency — Stripe REST via `fetch`; pinned `Stripe-Version: 2024-06-20`.
- Input validation: top-up amount whitelisted to `[5000, 20000, 50000]` NGN; `session_id`
  shape-validated (`^cs_[A-Za-z0-9_]+$`) to prevent path injection; method guards (POST on
  create, GET on verify); graceful `503` when not configured.
- Currency **NGN** (`amount × 100` minor units). To switch currency, also rescale the presets.

### Waitlist form
Multi-field signup (`waitlist.html`) with native validation; only the email persists locally.

---

## Stripe setup (current state)
- `STRIPE_SECRET_KEY` (a `sk_test_…` key) is set on the Vercel **production** environment.
- `create-checkout-session` returns a live test Checkout URL; NGN accepted; the sandbox
  top-up works end to end with test card **4242 4242 4242 4242**.
- The stored value technically has a trailing newline (harmless — the code trims it). To set
  it on `preview`/`development` too: `vercel env add STRIPE_SECRET_KEY preview` /
  `development`. Rotate the test key in the Stripe dashboard anytime.

---

## Quality process
Each substantive change was validated with a **multi-dimension adversarial review workflow**
(independent reviewers per dimension — correctness, security, a11y, responsive, SEO, content
honesty — each finding verified against the actual code before fixing). Totals fixed:
initial site **21**, multi-page **14**, Stripe sandbox **11**, Bridge **7**. Smaller iterative
changes were verified directly (markup greps + live endpoint checks).

## Conventions & decisions
- **Honesty stance:** no fabricated traction/testimonials; US-specific claims adapted to
  Nigeria (CBN/FCCPC/NDPA); figures are illustrative and the footer carries a disclaimer.
- **State:** sandbox *flow* state is ephemeral (resets on refresh); *approval* uses
  `sessionStorage` (survives refresh, re-locks on new session). Only email is persisted from
  the waitlist; no sensitive KYC fields stored.
- **Accessibility:** semantic landmarks, skip link, one `<h1>` per page, sequential headings,
  `aria-current`, a dual-tone focus ring visible on light/dark, `aria-live` status, reduced-
  motion support.
- **Tooling gotchas:** commit via the harness on Windows PowerShell — **avoid double quotes in
  commit messages** (they break native-arg parsing; use quote-free here-strings). LF→CRLF
  warnings on commit are harmless. The Vercel CLI wrapper prints a `claude-code-hint` to
  stderr — not an error.

## Launch TODOs
- Replace `azapay-website.vercel.app` with a custom domain in `canonical` / `og:url` /
  `og:image` / `twitter:image` / JSON-LD (and the API `success_url` derives from the request
  host automatically).
- Wire the waitlist + sandbox to real backends; provide lending/disbursement through licensed
  partners (e.g., Stripe Connect for real payouts).
- Validate all product terms/figures with local counsel and a licensed banking partner.
- Consider `localStorage` (instead of `sessionStorage`) if approval should persist across
  sessions; add a "lock again" control for repeat demos if desired.

## Run & deploy
```bash
# Run locally (no build step)
python -m http.server 8000     # then open http://localhost:8000

# Deploy
git push                       # auto-deploys via the GitHub→Vercel integration
vercel --prod                  # or deploy explicitly from this folder
```
