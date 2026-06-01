// GET /api/checkout-session?session_id=cs_test_...
// Retrieves a Checkout Session so the sandbox page can confirm the test payment
// on return from Stripe. Secret key stays server-side; only safe fields are returned.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key || !key.startsWith('sk_')) {
    return res.status(503).json({ error: 'stripe_not_configured' });
  }

  const id = String(req.query.session_id || req.query.id || '');
  // Validate shape to avoid any path injection into the Stripe URL.
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) {
    return res.status(400).json({ error: 'invalid_session_id' });
  }

  try {
    const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${id}`, {
      headers: { 'Authorization': `Bearer ${key}`, 'Stripe-Version': '2024-06-20' }
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: 'stripe_error', message: (data && data.error && data.error.message) || 'Stripe request failed.' });
    }
    return res.status(200).json({
      payment_status: data.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
      status: data.status,                 // 'open' | 'complete' | 'expired'
      amount_total: data.amount_total,      // in minor units (kobo for NGN)
      currency: data.currency
    });
  } catch (err) {
    return res.status(502).json({ error: 'network_error' });
  }
}
