/**
 * Cloudflare Pages Function — /api/crypto-verify
 * Checks if a NOWPayments order has been paid and returns the license key.
 *
 * GET /api/crypto-verify?order_id=<id>
 *
 * Responses:
 *   { success: true,  license_key: "CRY-XXXX-XXXX-XXXX" }  — paid & key ready
 *   { success: false, pending: true }                        — not yet confirmed
 *   { success: false, error: "..." }                         — error
 *
 * Environment variables:
 *   NOWPAYMENTS_API_KEY  — NOWPayments API key
 *   KRGUIDE_KV           — KV namespace binding
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => chars[b % chars.length])
      .join('');
  return `CRY-${seg()}-${seg()}-${seg()}`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const orderId = (url.searchParams.get('order_id') || '').trim();

  if (!orderId) {
    return json({ success: false, error: 'order_id is required.' }, 400);
  }
  if (!env.KRGUIDE_KV) {
    return json({ success: false, error: 'KV storage not configured.' }, 500);
  }

  // 1. Check KV first (IPN webhook may have already processed it)
  const stored = await env.KRGUIDE_KV.get(`crypto:order:${orderId}`);
  if (stored) {
    const data = JSON.parse(stored);
    return json({ success: true, license_key: data.license_key }, 200);
  }

  // 2. IPN hasn't fired yet — check NOWPayments API directly
  if (!env.NOWPAYMENTS_API_KEY) {
    return json({ success: false, pending: true }, 200);
  }

  let npRes;
  try {
    npRes = await fetch(
      `https://api.nowpayments.io/v1/payment?orderId=${encodeURIComponent(orderId)}&limit=1`,
      { headers: { 'x-api-key': env.NOWPAYMENTS_API_KEY } }
    );
  } catch {
    return json({ success: false, pending: true }, 200);
  }

  if (!npRes.ok) {
    return json({ success: false, pending: true }, 200);
  }

  const npData = await npRes.json();
  const payments = npData.data || [];
  const isFinished = payments.some(p => p.payment_status === 'finished');

  if (!isFinished) {
    return json({ success: false, pending: true }, 200);
  }

  // Payment confirmed — generate key and persist
  const licenseKey = generateLicenseKey();
  const paymentId = payments.find(p => p.payment_status === 'finished')?.payment_id;
  const record = JSON.stringify({ license_key: licenseKey, payment_id: paymentId, ts: Date.now() });
  const ttl = { expirationTtl: 60 * 60 * 24 * 365 };

  await Promise.all([
    env.KRGUIDE_KV.put(`crypto:order:${orderId}`, record, ttl),
    env.KRGUIDE_KV.put(`crypto:key:${licenseKey}`, record, ttl),
  ]);

  return json({ success: true, license_key: licenseKey }, 200);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
