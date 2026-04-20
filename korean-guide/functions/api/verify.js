/**
 * Cloudflare Pages Function — /api/verify
 * Verifies a license key for "Learn Korean Guide"
 *
 * Supports two key types:
 *   • Gumroad keys  — verified via Gumroad API
 *   • Crypto keys   — prefix "CRY-", verified via KV storage (issued by /api/webhook)
 *
 * Environment variables (Cloudflare Dashboard → Settings → Variables):
 *   GUMROAD_PRODUCT_PERMALINK  — e.g. "gnefla"
 *   KRGUIDE_KV                 — KV namespace binding
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  const ok  = body => new Response(JSON.stringify(body), { status: 200, headers: corsHeaders });
  const err = (body, status = 400) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return err({ success: false, error: 'Invalid request.' });
  }

  const licenseKey = (body.license_key || '').trim().toUpperCase();
  if (!licenseKey) {
    return err({ success: false, error: 'License key is required.' });
  }

  // ── Crypto key (CRY-XXXX-XXXX-XXXX) ──
  if (licenseKey.startsWith('CRY-')) {
    if (!env.KRGUIDE_KV) {
      return err({ success: false, error: 'KV storage not configured.' }, 500);
    }
    const stored = await env.KRGUIDE_KV.get(`crypto:key:${licenseKey}`);
    if (stored) {
      return ok({ success: true });
    }
    return ok({ success: false, error: 'Crypto license key not found. Please check and try again.' });
  }

  // ── Gumroad key ──
  const productPermalink = env.GUMROAD_PRODUCT_PERMALINK || 'gnefla';
  let gumroadRes;
  try {
    gumroadRes = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_permalink: productPermalink,
        license_key: licenseKey,
        increment_uses_count: 'false',
      }),
    });
  } catch {
    return err({ success: false, error: 'Verification service unavailable. Try again.' }, 502);
  }

  const gumroadData = await gumroadRes.json();

  if (gumroadData.success) {
    return ok({ success: true });
  }
  const reason = gumroadData.message || 'License key not found.';
  return ok({ success: false, error: reason });
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
