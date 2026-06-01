// POST /api/create-checkout-session
// Creates a Stripe TEST-mode Checkout Session for the AzaPay payments sandbox.
//
// Notes:
// - Calls the Stripe REST API directly via fetch (Node 18+), so there is NO npm
//   dependency and the project stays build-free.
// - The secret key is read from the STRIPE_SECRET_KEY env var and is NEVER sent to
//   the client. Only the resulting hosted-checkout `url` is returned.
// - This endpoint intentionally refuses live keys so the sandbox can't move real money.

const CURRENCY = 'ngn';                          // AzaPay is Nigeria-first. The presets below are
                                                 // naira-valued; if you switch currency, rescale
                                                 // ALLOWED_AMOUNTS too — don't reuse naira figures.
const ALLOWED_AMOUNTS = [5000, 20000, 50000];    // whole-naira top-up presets

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key || !key.startsWith('sk_')) {
    return res.status(503).json({
      error: 'stripe_not_configured',
      message: 'Add a Stripe TEST secret key (sk_test_…) as the STRIPE_SECRET_KEY environment variable in Vercel to enable live sandbox payments.'
    });
  }
  if (key.startsWith('sk_live_')) {
    return res.status(400).json({
      error: 'live_key_blocked',
      message: 'This sandbox only accepts a Stripe TEST key (sk_test_…).'
    });
  }

  // Vercel populates req.body for JSON; fall back to manual parse just in case.
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  let amount = parseInt(body.amount, 10);
  if (!ALLOWED_AMOUNTS.includes(amount)) amount = ALLOWED_AMOUNTS[0];

  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `${proto}://${host}`;

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${origin}/sandbox.html?status=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/sandbox.html?status=cancelled`);
  params.set('submit_type', 'pay');
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', CURRENCY);
  params.set('line_items[0][price_data][unit_amount]', String(amount * 100)); // NGN minor unit (kobo)
  params.set('line_items[0][price_data][product_data][name]', 'AzaPay wallet top-up (Sandbox)');
  params.set('line_items[0][price_data][product_data][description]', 'Stripe test-mode simulation — no real money moves.');
  params.set('metadata[purpose]', 'wallet_topup');
  params.set('metadata[sandbox]', 'true');

  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2024-06-20'
      },
      body: params.toString()
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: 'stripe_error', message: (data && data.error && data.error.message) || 'Stripe request failed.' });
    }
    return res.status(200).json({ url: data.url, id: data.id, amount: amount });
  } catch (err) {
    return res.status(502).json({ error: 'network_error', message: 'Could not reach Stripe.' });
  }
}
