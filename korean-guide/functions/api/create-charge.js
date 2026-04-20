/**
 * Cloudflare Pages Function — /api/create-charge
 * Creates a NOWPayments hosted invoice for "Learn Korean Guide"
 *
 * Environment variables (Cloudflare Dashboard → Settings → Variables):
 *   NOWPAYMENTS_API_KEY  — NOWPayments API key
 *   SITE_URL             — e.g. "https://your-site.pages.dev" (no trailing slash)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function generateOrderId() {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `krguide_${Date.now()}_${rand}`;
}

export async function onRequestPost(context) {
  const { env } = context;

  if (!env.NOWPAYMENTS_API_KEY) {
    return json({ success: false, error: 'Payment service not configured.' }, 500);
  }

  const siteUrl = (env.SITE_URL || '').replace(/\/$/, '');
  const orderId = generateOrderId();

  let npRes;
  try {
    npRes = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': env.NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: 9.90,
        price_currency: 'usd',
        order_id: orderId,
        order_description: 'Learn Korean Guide — Full Access (36 chapters)',
        ipn_callback_url: `${siteUrl}/api/webhook`,
        success_url: `${siteUrl}?crypto_return=1`,
        cancel_url: `${siteUrl}?crypto_cancel=1`,
      }),
    });
  } catch {
    return json({ success: false, error: 'Payment service unavailable. Try again.' }, 502);
  }

  if (!npRes.ok) {
    const errText = await npRes.text();
    console.error('NOWPayments error:', errText);
    return json({ success: false, error: 'Failed to create payment. Try again.' }, 500);
  }

  const npData = await npRes.json();

  return json({
    success: true,
    invoice_url: npData.invoice_url,
    order_id: orderId,
  }, 200);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
