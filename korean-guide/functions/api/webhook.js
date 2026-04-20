/**
 * Cloudflare Pages Function — /api/webhook
 * Receives NOWPayments IPN (Instant Payment Notification)
 * Verifies HMAC-SHA512 signature → on "finished" status, issues license key in KV
 *
 * Environment variables:
 *   NOWPAYMENTS_IPN_SECRET  — IPN secret key from NOWPayments dashboard
 *   KRGUIDE_KV              — KV namespace binding
 */

function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => chars[b % chars.length])
      .join('');
  return `CRY-${seg()}-${seg()}-${seg()}`;
}

async function verifyIPN(rawBody, signature, secret) {
  try {
    // NOWPayments: sort keys alphabetically, then HMAC-SHA512
    const body = JSON.parse(rawBody);
    const sorted = Object.keys(body).sort().reduce((acc, k) => {
      acc[k] = body[k];
      return acc;
    }, {});
    const sortedStr = JSON.stringify(sorted);

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false, ['sign']
    );
    const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(sortedStr));
    const sigHex = Array.from(new Uint8Array(sigBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    return sigHex === signature.toLowerCase();
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const rawBody = await request.text();
  const signature = request.headers.get('x-nowpayments-sig') || '';

  if (!env.NOWPAYMENTS_IPN_SECRET) {
    return new Response('IPN secret not configured', { status: 500 });
  }

  const valid = await verifyIPN(rawBody, signature, env.NOWPAYMENTS_IPN_SECRET);
  if (!valid) {
    return new Response('Unauthorized', { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { payment_status, order_id, payment_id } = event;

  // "finished" = fully confirmed payment
  if (payment_status === 'finished' && order_id && env.KRGUIDE_KV) {
    const existing = await env.KRGUIDE_KV.get(`crypto:order:${order_id}`);
    if (!existing) {
      const licenseKey = generateLicenseKey();
      const record = JSON.stringify({ license_key: licenseKey, payment_id, ts: Date.now() });
      const ttl = { expirationTtl: 60 * 60 * 24 * 365 }; // 1 year

      await Promise.all([
        env.KRGUIDE_KV.put(`crypto:order:${order_id}`, record, ttl),
        env.KRGUIDE_KV.put(`crypto:key:${licenseKey}`, record, ttl),
      ]);
    }
  }

  return new Response('OK', { status: 200 });
}
