/**
 * Cloudflare Pages Function — /api/verify
 * Verifies a Gumroad license key for "Learn Korean Guide"
 *
 * Environment variable to set in Cloudflare Dashboard:
 *   GUMROAD_PRODUCT_PERMALINK  — e.g. "learnkorean" (the part after gumroad.com/l/)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Parse body
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid request.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const licenseKey = (body.license_key || '').trim().toUpperCase();
  if (!licenseKey) {
    return new Response(JSON.stringify({ success: false, error: 'License key is required.' }), {
      status: 400, headers: corsHeaders,
    });
  }

  const productPermalink = env.GUMROAD_PRODUCT_PERMALINK || 'learnkorean';

  // Call Gumroad license verification API
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
    return new Response(JSON.stringify({ success: false, error: 'Verification service unavailable. Try again.' }), {
      status: 502, headers: corsHeaders,
    });
  }

  const gumroadData = await gumroadRes.json();

  if (gumroadData.success) {
    // Valid purchase
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: corsHeaders,
    });
  } else {
    // Invalid or refunded key
    const reason = gumroadData.message || 'License key not found.';
    return new Response(JSON.stringify({ success: false, error: reason }), {
      status: 200, headers: corsHeaders,
    });
  }
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
