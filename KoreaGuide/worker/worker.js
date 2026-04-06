/**
 * KR Guide — WordPress 자동 포스팅 Worker
 * Travel Guide 단일 카테고리 집중 | 토픽 매칭 이미지 | 프리미엄 디자인
 *
 * 환경변수 (Cloudflare Dashboard Secret):
 *   ANTHROPIC_API_KEY  — Anthropic API 키
 *   WP_APP_PASSWORD    — WordPress 애플리케이션 비밀번호
 *   WP_USERNAME        — WordPress 사용자명
 *   WP_URL             — WordPress 사이트 URL (예: https://krguide.com)
 */

// ── 단일 카테고리 집중: Travel Guide ──
const CATEGORY_ID = 2;

const TOPICS = [
  "Best Things to Do in Busan — Korea's Second City",
  "Jeju Island Complete Travel Guide — Everything You Need to Know",
  "Korean Street Food Guide — 20 Must-Try Foods and Where to Find Them",
  "Best Day Trips from Seoul — Hidden Gems Within 2 Hours",
  "Gyeongju Travel Guide — Korea's Ancient Capital and UNESCO Heritage Sites",
  "Hiking in Korea — Best Mountain Trails for Every Level",
  "Korea in Spring — Ultimate Cherry Blossom Guide",
  "DMZ Tour Guide — Visiting the Korean Demilitarized Zone",
  "Best Cafes in Seoul — A Neighborhood-by-Neighborhood Guide",
  "Namsan Seoul Tower — Complete Visitor Guide",
  "Insadong Travel Guide — Art, Culture and Traditional Shopping in Seoul",
  "Gangnam District Guide — Beyond the K-pop Cliché",
  "Korean Night Markets — Where Locals Actually Eat",
  "Bukchon Hanok Village — Seoul's Most Beautiful Traditional Neighborhood",
  "Sokcho and Seoraksan — Korea's Most Spectacular Mountain Escape",
];

// ── 토픽별 Unsplash 이미지 풀 (검증된 200 OK URL만) ──
const TOPIC_IMAGES = {
  busan: [
    { url: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=1200&auto=format&fit=crop&q=80", alt: "Colorful Gamcheon Culture Village hillside buildings, Busan South Korea" },
    { url: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&auto=format&fit=crop&q=80", alt: "Busan city coastal view with ocean and buildings" },
    { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&auto=format&fit=crop&q=80", alt: "Scenic coastal area near Busan South Korea" },
    { url: "https://images.unsplash.com/photo-1499678329028-101435549a4e?w=1200&auto=format&fit=crop&q=80", alt: "Beautiful coastal landscape South Korea" },
  ],
  jeju: [
    { url: "https://images.unsplash.com/photo-1540569014015-19a7be504e3a?w=1200&auto=format&fit=crop&q=80", alt: "Stunning natural landscape of Jeju Island South Korea" },
    { url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80", alt: "Jeju Island volcanic mountain and green landscape" },
    { url: "https://images.unsplash.com/photo-1499678329028-101435549a4e?w=1200&auto=format&fit=crop&q=80", alt: "Tropical island beach and turquoise water, Jeju" },
  ],
  palace: [
    { url: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=1200&auto=format&fit=crop&q=80", alt: "Traditional Korean palace architecture in Seoul" },
    { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&auto=format&fit=crop&q=80", alt: "Historic Korean palace gate and courtyard" },
    { url: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&auto=format&fit=crop&q=80", alt: "Gyeongbokgung Palace with mountain backdrop Seoul" },
  ],
  food: [
    { url: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=1200&auto=format&fit=crop&q=80", alt: "Korean traditional cuisine spread with banchan side dishes" },
    { url: "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=1200&auto=format&fit=crop&q=80", alt: "Authentic Korean restaurant meal with multiple colorful dishes" },
    { url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=80", alt: "Fresh Korean food bowl with vegetables and rice" },
    { url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&auto=format&fit=crop&q=80", alt: "Colorful Korean street food and snacks at night market" },
    { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80", alt: "Korean BBQ and traditional food dishes" },
    { url: "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?w=1200&auto=format&fit=crop&q=80", alt: "Korean cuisine with grilled meat and side dishes" },
  ],
  hanok: [
    { url: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=1200&auto=format&fit=crop&q=80", alt: "Traditional Korean hanok village rooftop tiled views" },
    { url: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&auto=format&fit=crop&q=80", alt: "Bukchon Hanok Village traditional houses Seoul" },
    { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&auto=format&fit=crop&q=80", alt: "Historic Korean village with traditional wooden architecture" },
  ],
  spring: [
    { url: "https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1200&auto=format&fit=crop&q=80", alt: "Cherry blossoms in full bloom along Korean street" },
    { url: "https://images.unsplash.com/photo-1491555103944-7c647fd857e6?w=1200&auto=format&fit=crop&q=80", alt: "Spring cherry blossom festival in Korea" },
    { url: "https://images.unsplash.com/photo-1467139701929-18c0d27a7516?w=1200&auto=format&fit=crop&q=80", alt: "Cherry blossoms and spring flowers Korea" },
  ],
  temple: [
    { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200&auto=format&fit=crop&q=80", alt: "Ancient Korean Buddhist temple architecture" },
    { url: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=1200&auto=format&fit=crop&q=80", alt: "Traditional Korean temple gate and stone lanterns" },
    { url: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&auto=format&fit=crop&q=80", alt: "Bulguksa Temple UNESCO heritage site Gyeongju Korea" },
  ],
  seoul: [
    { url: "https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=1200&auto=format&fit=crop&q=80", alt: "Seoul city skyline illuminated at night, South Korea" },
    { url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1200&auto=format&fit=crop&q=80", alt: "Modern Seoul downtown district with skyscrapers" },
    { url: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=1200&auto=format&fit=crop&q=80", alt: "Seoul panoramic view from Namsan Tower" },
    { url: "https://images.unsplash.com/photo-1562552476-8ac59b2a2e46?w=1200&auto=format&fit=crop&q=80", alt: "Seoul Han River and city lights at dusk" },
  ],
  default: [
    { url: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=1200&auto=format&fit=crop&q=80", alt: "Beautiful South Korea travel destination" },
    { url: "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200&auto=format&fit=crop&q=80", alt: "Korea scenic landscape and culture" },
    { url: "https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=1200&auto=format&fit=crop&q=80", alt: "South Korea travel guide landscape" },
  ],
};

function getSearchQuery(topic) {
  const t = topic.toLowerCase();
  if (t.includes("busan")) return "Busan Korea city";
  if (t.includes("jeju")) return "Jeju Island Korea";
  if (t.includes("gyeongju")) return "Gyeongju Korea ancient";
  if (t.includes("palace") || t.includes("gyeongbokgung")) return "Gyeongbokgung palace Seoul Korea";
  if (t.includes("street food") || t.includes("food") || t.includes("eat")) return "Korean street food market";
  if (t.includes("hanok") || t.includes("bukchon")) return "Bukchon Hanok Village Seoul";
  if (t.includes("insadong")) return "Insadong Seoul traditional";
  if (t.includes("spring") || t.includes("cherry blossom")) return "Korea cherry blossom spring";
  if (t.includes("temple") || t.includes("bulguksa")) return "Korea Buddhist temple";
  if (t.includes("hiking") || t.includes("mountain") || t.includes("seoraksan")) return "Korea mountain hiking trail";
  if (t.includes("dmz")) return "DMZ Korea demilitarized zone";
  if (t.includes("namsan") || t.includes("tower")) return "Namsan Seoul Tower";
  if (t.includes("cafe") || t.includes("gangnam")) return "Seoul cafe Korea";
  if (t.includes("sokcho")) return "Seoraksan mountain Korea";
  if (t.includes("night market")) return "Korea night market food";
  return "South Korea travel scenery";
}

async function fetchUnsplashImages(topic, apiKey) {
  const query = getSearchQuery(topic);
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6&orientation=landscape`;
  try {
    const res = await fetch(url, { headers: { "Authorization": `Client-ID ${apiKey}` } });
    if (!res.ok) throw new Error(`Unsplash error: ${res.status}`);
    const data = await res.json();
    const results = data.results || [];
    if (results.length < 2) throw new Error("Not enough results");
    // 16:9 규격으로 요청 (1200×675)
    return results.slice(0, 4).map(r => ({
      url: r.urls.raw + "&w=1200&h=675&fit=crop&auto=format&q=80",
      alt: r.alt_description || r.description || `${query} photo`
    }));
  } catch (e) {
    console.error("Unsplash fetch failed:", e.message);
    return null;
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTwo(arr) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1] || shuffled[0]];
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(autoPost(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "POST") {
      ctx.waitUntil(autoPost(env).then(r => console.log("autoPost result:", JSON.stringify(r))).catch(e => console.error("autoPost error:", e)));
      return new Response(JSON.stringify({ queued: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.pathname === "/trigger-sync" && request.method === "POST") {
      const result = await autoPost(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url.pathname === "/debug-claude" && request.method === "POST") {
      const topic = "Jeju Island — Korea's Volcanic Paradise";
      void getImagesForTopic(topic);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 300, messages: [{ role: "user", content: `Say: ===HTML_START===\n<p>Hello</p>\n===HTML_END===\n===EXCERPT_START===\nExcerpt here\n===EXCERPT_END===` }] }),
      });
      const data = await response.json();
      const text = data?.content?.[0]?.text || "no text";
      return new Response(JSON.stringify({ raw: text, status: response.status }), { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/api/hit") {
      const origin = request.headers.get("Origin") || "*";
      const corsHeaders = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (request.method === "POST") {
        const current = parseInt((await env.ANALYTICS.get("page_views")) || "0", 10);
        const updated = current + 1;
        await env.ANALYTICS.put("page_views", String(updated));
        return new Response(JSON.stringify({ views: updated }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/api/views") {
      const origin = request.headers.get("Origin") || "*";
      const views = parseInt((await env.ANALYTICS.get("page_views")) || "0", 10);
      return new Response(JSON.stringify({ views }), {
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === "/update-menu" && request.method === "POST") {
      const token = url.searchParams.get("token");
      if (token !== "krguide-home-2026") {
        return new Response("Unauthorized", { status: 401 });
      }
      const result = await updateMenu(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/deploy-homepage" && request.method === "POST") {
      const token = url.searchParams.get("token");
      if (token !== "krguide-home-2026") {
        return new Response("Unauthorized", { status: 401 });
      }
      const result = await deployHomepage(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("KR Guide Auto Post Worker — Travel Guide", { status: 200 });
  },
};

async function autoPost(env) {
  try {
    const topic = pickRandom(TOPICS);

    // Unsplash API로 주제에 맞는 이미지 가져오기
    let heroImage, secondImage;
    const unsplashImages = env.UNSPLASH_ACCESS_KEY
      ? await fetchUnsplashImages(topic, env.UNSPLASH_ACCESS_KEY)
      : null;
    if (unsplashImages && unsplashImages.length >= 2) {
      [heroImage, secondImage] = unsplashImages;
    } else {
      // 폴백: 기존 하드코딩 이미지
      const imagePool = TOPIC_IMAGES.default;
      [heroImage, secondImage] = pickTwo(imagePool);
    }

    console.log(`Generating post: [Travel Guide] ${topic}`);

    const content = await generatePost(topic, heroImage, secondImage, env.ANTHROPIC_API_KEY);
    if (!content) throw new Error("Failed to generate content");

    const result = await publishToWordPress(
      {
        title: topic,
        content: content.html,
        excerpt: content.excerpt,
        categoryId: CATEGORY_ID,
        slug: slugify(topic),
      },
      env
    );

    console.log("Published:", result.link);
    return { success: true, title: topic, link: result.link };
  } catch (err) {
    console.error("Auto post error:", err);
    return { success: false, error: err.message };
  }
}

async function generatePost(topic, heroImage, secondImage, apiKey) {
  const systemPrompt = `You are a professional Korea travel guide with 12+ years of living in Korea. You write for KR Guide (krguide.com).

Your voice and style — non-negotiable:
- Write exactly like a knowledgeable, warm-hearted friend who has lived in Korea for years — NOT like a travel brochure or Wikipedia article
- Every sentence flows naturally, as if you are personally guiding the reader through Korea
- Use "you" and "I" freely — this is personal, direct, and conversational
- Never sound like you are listing facts. Weave information into narrative, stories, and personal insight
- Be specific and honest: real prices in KRW and USD, real subway exits, real neighborhood names, real timing
- Acknowledge challenges and quirks — that is what makes advice trustworthy
- Your enthusiasm for Korea must feel genuine, not promotional

SEO and keyword rules:
- The exact topic title MUST appear naturally in the very first sentence of the article
- 3–5 important keywords from the title must be distributed naturally throughout the article — in headings, early paragraphs, mid-article, and conclusion
- Never stuff keywords — they must read naturally in context
- Write a minimum of 2,000 words — comprehensive, in-depth, zero padding

Quality standard: Every paragraph must contain at least one specific, actionable detail that only an insider would know.`;

  const userPrompt = `Write a visually rich, deeply informative, SEO-optimized Korea travel guide for: "${topic}"

━━━ REQUIRED GUTENBERG BLOCK STRUCTURE ━━━

**[0] PREMIUM CSS + ANIMATIONS — insert FIRST:**
<!-- wp:html -->
<style>
@keyframes fadeInUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
.krg-article{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.krg-article p{text-align:justify;line-height:1.95;font-size:1.08rem;color:#1a1a2e;animation:fadeInUp .6s ease both}
.krg-article h2{font-size:1.65rem;font-weight:800;color:#1a1a2e;margin-top:2.8rem;padding-bottom:10px;border-bottom:3px solid #e8302a;animation:fadeInUp .5s ease both}
.krg-article h3{font-size:1.2rem;font-weight:700;color:#e8302a;margin-top:1.8rem;animation:fadeInUp .5s ease both}
.krg-stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:14px;margin:28px 0}
.krg-stat{background:linear-gradient(135deg,#1a1a2e,#2d3561);color:#fff;border-radius:14px;padding:20px 16px;text-align:center;animation:fadeInUp .6s ease both;transition:transform .2s}
.krg-stat:hover{transform:translateY(-4px)}
.krg-stat-num{font-size:1.9rem;font-weight:900;color:#f97316;line-height:1}
.krg-stat-lbl{font-size:.72rem;color:#94a3b8;margin-top:5px;text-transform:uppercase;letter-spacing:.06em}
.krg-tip{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-left:5px solid #3b82f6;border-radius:12px;padding:22px 26px;margin:24px 0;animation:fadeInUp .6s ease both}
.krg-tip-title{font-weight:800;color:#1d4ed8;font-size:1.02rem;margin-bottom:8px}
.krg-warn{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-left:5px solid #f59e0b;border-radius:12px;padding:22px 26px;margin:24px 0;animation:fadeInUp .6s ease both}
.krg-warn-title{font-weight:800;color:#b45309;font-size:1.02rem;margin-bottom:8px}
.krg-dark{background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:16px;padding:30px 34px;margin:28px 0;color:#fff;animation:fadeInUp .6s ease both}
.krg-dark p{color:#cbd5e1;animation:none}
.krg-green{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-left:5px solid #22c55e;border-radius:12px;padding:22px 26px;margin:24px 0;animation:fadeInUp .6s ease both}
.krg-green-title{font-weight:800;color:#15803d;font-size:1.02rem;margin-bottom:8px}
.krg-pull{font-size:1.35rem;font-weight:700;color:#1a1a2e;text-align:center;border-top:3px solid #e8302a;border-bottom:3px solid #e8302a;padding:24px 20px;margin:32px 0;line-height:1.5;background:linear-gradient(135deg,#fff5f5,#fff);animation:fadeIn .8s ease both}
.krg-img-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:28px 0}
.krg-img-grid img{width:100%;height:220px;object-fit:cover;border-radius:10px;display:block;transition:transform .3s}
.krg-img-grid img:hover{transform:scale(1.02)}
.krg-checklist li{padding:5px 0;color:#1a1a2e}
.krg-checklist li::marker{color:#22c55e;font-size:1.1rem}
@media(max-width:600px){.krg-img-grid{grid-template-columns:1fr}.krg-stat-row{grid-template-columns:repeat(2,1fr)}}
</style>
<!-- /wp:html -->

<!-- wp:html --><div class="krg-article"><!-- /wp:html -->

**[1] HERO IMAGE — full width (use EXACTLY this src, do not change it):**
<!-- wp:image {"align":"full","sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image alignfull size-full"><img src="__HERO_SRC__" alt="__HERO_ALT__" /></figure>
<!-- /wp:image -->

**[2] INTRO — 2 vivid paragraphs. Hook reader, make them feel they're already there:**
<!-- wp:paragraph -->
<p style="text-align:justify">[Intro — first sentence MUST contain the exact title: "${topic}"]</p>
<!-- /wp:paragraph -->

**[3] STAT BOXES — 4 key facts (numbers, years, distances):**
<!-- wp:html -->
<div class="krg-stat-row">
  <div class="krg-stat"><div class="krg-stat-num">[#]</div><div class="krg-stat-lbl">[label]</div></div>
  <div class="krg-stat"><div class="krg-stat-num">[#]</div><div class="krg-stat-lbl">[label]</div></div>
  <div class="krg-stat"><div class="krg-stat-num">[#]</div><div class="krg-stat-lbl">[label]</div></div>
  <div class="krg-stat"><div class="krg-stat-num">[#]</div><div class="krg-stat-lbl">[label]</div></div>
</div><!-- /wp:html -->

**[4] MAIN SECTIONS — 3 H2 sections with rich paragraphs:**
<!-- wp:heading {"level":2} --><h2>[Section]</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p style="text-align:justify">[content with prices KRW/USD, subway exits, insider tips]</p><!-- /wp:paragraph -->

**[5] PRO TIP BOX:**
<!-- wp:html --><div class="krg-tip"><div class="krg-tip-title">💡 Insider Pro Tip</div><p style="color:#1e3a8a;margin:0;line-height:1.85">[specific local tip]</p></div><!-- /wp:html -->

**[6] 2-COLUMN IMAGE GRID (use EXACTLY these src values, do not change them):**
<!-- wp:html --><div class="krg-img-grid"><img src="__HERO_SRC__" alt="__HERO_ALT__" loading="lazy" /><img src="__SECOND_SRC__" alt="__SECOND_ALT__" loading="lazy" /></div><!-- /wp:html -->

**[7] WARNING BOX:**
<!-- wp:html --><div class="krg-warn"><div class="krg-warn-title">⚠️ Common Mistakes</div><ul style="margin:0;padding-left:20px;color:#1a1a2e;line-height:1.9"><li>[mistake + fix]</li><li>[mistake + fix]</li><li>[mistake + fix]</li></ul></div><!-- /wp:html -->

**[8] DARK CONTEXT BOX:**
<!-- wp:html --><div class="krg-dark"><p style="color:#f97316;font-weight:800;margin-bottom:10px">🇰🇷 Know Before You Go</p><p style="color:#cbd5e1;margin:0;line-height:1.9">[cultural context for foreigners]</p></div><!-- /wp:html -->

**[9] GREEN CHECKLIST:**
<!-- wp:html --><div class="krg-green"><div class="krg-green-title">✅ Quick Checklist</div><ul class="krg-checklist" style="margin:0;padding-left:22px;line-height:1.9"><li>[item]</li><li>[item]</li><li>[item]</li><li>[item]</li></ul></div><!-- /wp:html -->

**[10] CONCLUSION — 1 paragraph:**
<!-- wp:paragraph --><p style="text-align:justify">[warm conclusion]</p><!-- /wp:paragraph -->

<!-- wp:html --></div><!-- /wp:html -->

━━━ CONTENT RULES ━━━
- Total: 700–900 words (rich but concise — quality over length)
- First sentence MUST contain: "${topic}"
- Prices always in ₩ and USD (~$X)
- Subway: line number + exit (e.g., "Line 3, Exit 2")
- Stat boxes: use real numbers (year built, area in km², visitor count, altitude, etc.)
- Every section must have one detail only a local would know

━━━ OUTPUT FORMAT ━━━
===HTML_START===
{complete Gutenberg HTML}
===HTML_END===
===EXCERPT_START===
{one compelling sentence, max 155 chars}
===EXCERPT_END===`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  const stopReason = data.stop_reason;

  function injectImages(html) {
    return html
      .replace(/__HERO_SRC__/g, heroImage.url)
      .replace(/__HERO_ALT__/g, heroImage.alt)
      .replace(/__SECOND_SRC__/g, secondImage.url)
      .replace(/__SECOND_ALT__/g, secondImage.alt);
  }

  // 구분자 형식 파싱
  const htmlMatch = text.match(/===HTML_START===\s*([\s\S]*?)\s*===HTML_END===/);
  if (htmlMatch) {
    const excerptMatch = text.match(/===EXCERPT_START===\s*([\s\S]*?)\s*===EXCERPT_END===/);
    return { html: injectImages(htmlMatch[1].trim()), excerpt: excerptMatch ? excerptMatch[1].trim() : "" };
  }

  // 토큰 한도로 잘린 경우 — HTML_START만 있으면 중간에 잘린 내용이라도 사용
  if (stopReason === "max_tokens") {
    const partialMatch = text.match(/===HTML_START===\s*([\s\S]+)/);
    if (partialMatch) {
      return { html: injectImages(partialMatch[1].trim()), excerpt: "" };
    }
  }

  throw new Error(`No parseable content. stop_reason=${stopReason}, preview=${text.slice(0,100)}`);
}

async function publishToWordPress(post, env) {
  const credentials = btoa(`${env.WP_USERNAME}:${env.WP_APP_PASSWORD}`);

  const response = await fetch(`${env.WP_URL}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      slug: post.slug,
      status: "publish",
      categories: [post.categoryId],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`WordPress API error: ${response.status} — ${err}`);
  }

  return response.json();
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ── Homepage Deploy ───────────────────────────────────────────────────────────

const CAT_LABELS = { "2": "Travel Guide", "3": "Living in Korea", "4": "Learn Korean" };

async function deployHomepage(env) {
  try {
    const WP_URL = env.WP_URL.replace(/\/$/, "");
    const credentials = btoa(`${env.WP_USERNAME}:${env.WP_APP_PASSWORD}`);
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    };

    // Fetch 6 latest posts
    const postsRes = await fetch(
      `${WP_URL}/wp-json/wp/v2/posts?per_page=6&_fields=id,title,excerpt,slug,categories`
    );
    const posts = postsRes.ok ? await postsRes.json() : [];

    // Build article cards
    const articleCards = posts.length > 0
      ? posts.map(post => {
          const catId    = String(post.categories?.[0] || 2);
          const catLabel = CAT_LABELS[catId] || "Guide";
          const excerpt  = (post.excerpt?.rendered || "").replace(/<[^>]*>/g, "").trim().slice(0, 180);
          return `<a href="${WP_URL}/${post.slug}/" class="krg-article-card">
  <div class="krg-article-card-body">
    <div class="krg-article-cat">${catLabel}</div>
    <h3 class="krg-article-title">${post.title?.rendered || ""}</h3>
    <p class="krg-article-excerpt">${excerpt}</p>
    <span class="krg-article-link">Read More &#x2192;</span>
  </div>
</a>`;
        }).join("\n")
      : '<div class="krg-article-placeholder">New articles coming soon!</div>';

    const articleCardCss = `<!-- wp:html -->
<style>
.krg-article-card{display:flex;flex-direction:column;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 2px 16px rgba(15,23,42,.07);border:1px solid rgba(15,23,42,.06);text-decoration:none;color:inherit;transition:transform .25s,box-shadow .25s}
.krg-article-card:hover{transform:translateY(-5px);box-shadow:0 14px 40px rgba(15,23,42,.12)}
.krg-article-card-body{padding:24px;flex:1;display:flex;flex-direction:column}
.krg-article-cat{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#e8a020;margin-bottom:10px}
.krg-article-title{font-size:1.02rem;font-weight:800;color:#0f172a;margin:0 0 10px;line-height:1.4}
.krg-article-excerpt{font-size:.88rem;color:#64748b;line-height:1.7;text-align:justify;flex:1;margin:0}
.krg-article-link{display:inline-flex;align-items:center;gap:6px;margin-top:16px;color:#e8a020;font-size:.85rem;font-weight:700}
</style>
<!-- /wp:html -->

`;

    const homeContent = articleCardCss + HOMEPAGE_TEMPLATE.replace("{{RECENT_POSTS}}", articleCards);

    // Find or create home page
    const pagesRes = await fetch(`${WP_URL}/wp-json/wp/v2/pages?slug=home&_fields=id,slug`, {
      headers: authHeaders,
    });
    const existingPages = pagesRes.ok ? await pagesRes.json() : [];
    let pageId;

    if (existingPages.length > 0) {
      pageId = existingPages[0].id;
      const upd = await fetch(`${WP_URL}/wp-json/wp/v2/pages/${pageId}`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ title: "Home", content: homeContent, status: "publish" }),
      });
      if (!upd.ok) throw new Error(`Update page failed: ${upd.status} ${await upd.text()}`);
    } else {
      const cre = await fetch(`${WP_URL}/wp-json/wp/v2/pages`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ title: "Home", slug: "home", content: homeContent, status: "publish" }),
      });
      if (!cre.ok) throw new Error(`Create page failed: ${cre.status} ${await cre.text()}`);
      const created = await cre.json();
      pageId = created.id;
    }

    // Set as static front page
    await fetch(`${WP_URL}/wp-json/wp/v2/settings`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ show_on_front: "page", page_on_front: pageId }),
    });

    return { success: true, pageId, postsInjected: posts.length, url: `${WP_URL}/` };
  } catch (err) {
    console.error("Deploy homepage error:", err);
    return { success: false, error: err.message };
  }
}

// ── 메뉴 업데이트 ──────────────────────────────────────────────────────────────
async function updateMenu(env) {
  const WP_URL = env.WP_URL;
  const credentials = btoa(`${env.WP_USERNAME}:${env.WP_APP_PASSWORD}`);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Basic ${credentials}`,
  };

  // 1) 현재 wp_navigation 목록 가져오기
  const navRes = await fetch(`${WP_URL}/wp-json/wp/v2/navigation?context=edit&per_page=20`, { headers });
  if (!navRes.ok) throw new Error(`Navigation list error: ${navRes.status} ${await navRes.text()}`);
  const navList = await navRes.json();
  if (!navList.length) throw new Error("No navigation found");

  // 첫 번째(주) 네비게이션 사용
  const nav = navList[0];
  const navId = nav.id;

  // 2) 새 메뉴 블록 콘텐츠 구성
  // 원하는 순서: Home / Travel Guide / Learn Korean / Korean Restaurants / About
  const newContent = `<!-- wp:navigation-link {"label":"Home","url":"/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Travel Guide","url":"/category/travel-guide/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Learn Korean","url":"/category/learn-korean/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"Korean Restaurants","url":"/category/korean-restaurants/","kind":"custom","isTopLevelLink":true} /-->
<!-- wp:navigation-link {"label":"About","url":"/about/","kind":"custom","isTopLevelLink":true} /-->`;

  // 3) 네비게이션 업데이트
  const updRes = await fetch(`${WP_URL}/wp-json/wp/v2/navigation/${navId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content: newContent, status: "publish" }),
  });
  if (!updRes.ok) throw new Error(`Navigation update error: ${updRes.status} ${await updRes.text()}`);
  const updated = await updRes.json();
  return { success: true, navId, title: updated.title?.rendered };
}

// ── Homepage HTML Template ────────────────────────────────────────────────────
// (Gutenberg block format — raw HTML blocks)

const HOMEPAGE_TEMPLATE = `<!-- wp:html -->
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.krg-hero{position:relative;min-height:92vh;display:flex;align-items:center;justify-content:center;text-align:center;background-color:#0f172a;background-image:linear-gradient(to bottom,rgba(15,23,42,0.55) 0%,rgba(15,23,42,0.72) 60%,rgba(15,23,42,0.95) 100%),url('https://images.unsplash.com/photo-1538484956234-45f0a1073a6e?w=1600&auto=format&fit=crop&q=80');background-size:cover;background-position:center top;padding:80px 24px 100px;overflow:hidden}
.krg-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%,rgba(232,160,32,0.08) 0%,transparent 70%);pointer-events:none}
.krg-hero-badge{display:inline-block;background:rgba(232,160,32,0.18);border:1px solid rgba(232,160,32,0.45);color:#e8a020;font-size:.78rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;padding:6px 18px;border-radius:100px;margin-bottom:28px}
.krg-hero-inner{position:relative;z-index:2;max-width:820px;margin:0 auto}
.krg-hero h1{font-size:clamp(2.4rem,6vw,4.2rem);font-weight:800;line-height:1.13;color:#fff;margin-bottom:24px;letter-spacing:-.02em}
.krg-hero h1 span{color:#e8a020}
.krg-hero p{font-size:clamp(1rem,2.2vw,1.22rem);color:rgba(255,255,255,.78);max-width:600px;margin:0 auto 40px;line-height:1.75;text-align:justify}
.krg-hero-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
.krg-btn-primary{display:inline-flex;align-items:center;gap:8px;background:#e8a020;color:#0f172a;font-size:1rem;font-weight:700;padding:15px 34px;border-radius:8px;text-decoration:none;letter-spacing:.01em;transition:background .2s,transform .18s,box-shadow .2s;box-shadow:0 4px 24px rgba(232,160,32,.32)}
.krg-btn-primary:hover{background:#f0b030;transform:translateY(-2px);box-shadow:0 8px 32px rgba(232,160,32,.42)}
.krg-btn-ghost{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;font-size:1rem;font-weight:600;padding:14px 30px;border-radius:8px;border:1.5px solid rgba(255,255,255,.35);text-decoration:none;transition:border-color .2s,background .2s}
.krg-btn-ghost:hover{border-color:#e8a020;color:#e8a020;background:rgba(232,160,32,.07)}
.krg-hero-stats{display:flex;justify-content:center;gap:48px;margin-top:60px;flex-wrap:wrap}
.krg-stat{text-align:center}
.krg-stat-num{display:block;font-size:2rem;font-weight:800;color:#e8a020;line-height:1.1}
.krg-stat-label{display:block;font-size:.82rem;color:rgba(255,255,255,.55);letter-spacing:.08em;text-transform:uppercase;margin-top:4px}
.krg-scroll-hint{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;color:rgba(255,255,255,.4);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase}
.krg-scroll-hint-line{width:1px;height:40px;background:linear-gradient(to bottom,rgba(255,255,255,.3),transparent);animation:scrollPulse 1.8s ease-in-out infinite}
@keyframes scrollPulse{0%,100%{opacity:.3;transform:scaleY(1)}50%{opacity:1;transform:scaleY(.7)}}
.krg-section{padding:96px 24px}
.krg-section-light{background:#fff}
.krg-section-gray{background:#f8fafc}
.krg-section-dark{background:#0f172a}
.krg-container{max-width:1180px;margin:0 auto}
.krg-section-label{display:block;text-align:center;font-size:.75rem;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#e8a020;margin-bottom:14px}
.krg-section-title{text-align:center;font-size:clamp(1.7rem,3.5vw,2.5rem);font-weight:800;color:#0f172a;letter-spacing:-.02em;margin-bottom:16px;line-height:1.2}
.krg-section-title-light{color:#fff}
.krg-section-sub{text-align:center;font-size:1.05rem;color:#64748b;max-width:560px;margin:0 auto 64px;line-height:1.75}
.krg-section-sub-light{color:rgba(255,255,255,.65)}
.krg-cards-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.krg-card{border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 2px 16px rgba(15,23,42,.07);transition:transform .25s,box-shadow .25s;text-decoration:none;color:inherit;display:flex;flex-direction:column;border:1px solid rgba(15,23,42,.06)}
.krg-card:hover{transform:translateY(-6px);box-shadow:0 16px 48px rgba(15,23,42,.13)}
.krg-card-img-wrap{position:relative;height:210px;overflow:hidden}
.krg-card-img-wrap img{width:100%;height:100%;object-fit:cover;transition:transform .4s}
.krg-card:hover .krg-card-img-wrap img{transform:scale(1.06)}
.krg-card-img-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(15,23,42,.55) 0%,transparent 55%)}
.krg-card-icon{position:absolute;top:16px;left:16px;width:44px;height:44px;background:rgba(232,160,32,.92);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 4px 12px rgba(0,0,0,.18)}
.krg-card-body{padding:24px;flex:1;display:flex;flex-direction:column}
.krg-card-title{font-size:1.25rem;font-weight:800;color:#0f172a;margin-bottom:10px}
.krg-card-desc{font-size:.93rem;color:#64748b;line-height:1.7;text-align:justify;flex:1}
.krg-card-link{display:inline-flex;align-items:center;gap:6px;margin-top:20px;color:#e8a020;font-size:.9rem;font-weight:700;text-decoration:none;letter-spacing:.01em;transition:gap .2s}
.krg-card-link:hover{gap:10px}
.krg-articles-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:16px}
.krg-articles-header-left{text-align:left}
.krg-articles-header-left .krg-section-label{text-align:left}
.krg-articles-header-left .krg-section-title{text-align:left;margin-bottom:0}
.krg-btn-outline{display:inline-flex;align-items:center;gap:8px;border:2px solid #e8a020;color:#e8a020;font-size:.9rem;font-weight:700;padding:11px 26px;border-radius:8px;text-decoration:none;transition:background .2s,color .2s;white-space:nowrap}
.krg-btn-outline:hover{background:#e8a020;color:#0f172a}
.krg-articles-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.krg-article-placeholder{background:#f1f5f9;border-radius:14px;padding:40px 32px;text-align:center;color:#94a3b8;font-size:.9rem;border:2px dashed #e2e8f0}
.krg-trust-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:32px;margin-top:64px}
.krg-trust-item{text-align:center;padding:40px 28px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:16px;transition:background .2s,transform .2s}
.krg-trust-item:hover{background:rgba(255,255,255,.09);transform:translateY(-4px)}
.krg-trust-icon{width:64px;height:64px;background:rgba(232,160,32,.15);border:1px solid rgba(232,160,32,.3);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;margin:0 auto 24px}
.krg-trust-title{font-size:1.15rem;font-weight:800;color:#fff;margin-bottom:12px}
.krg-trust-desc{font-size:.9rem;color:rgba(255,255,255,.6);line-height:1.75;text-align:justify}
.krg-newsletter-wrap{background:linear-gradient(135deg,#e8a020 0%,#d4891a 100%);border-radius:24px;padding:72px 48px;text-align:center;position:relative;overflow:hidden}
.krg-newsletter-wrap::before{content:'';position:absolute;top:-60px;right:-60px;width:240px;height:240px;background:rgba(255,255,255,.1);border-radius:50%;pointer-events:none}
.krg-newsletter-wrap::after{content:'';position:absolute;bottom:-80px;left:-40px;width:300px;height:300px;background:rgba(255,255,255,.07);border-radius:50%;pointer-events:none}
.krg-newsletter-inner{position:relative;z-index:2;max-width:560px;margin:0 auto}
.krg-newsletter-wrap h2{font-size:clamp(1.6rem,3.5vw,2.2rem);font-weight:800;color:#0f172a;margin-bottom:14px;letter-spacing:-.02em}
.krg-newsletter-wrap p{font-size:1rem;color:rgba(15,23,42,.7);margin-bottom:36px;line-height:1.7;text-align:justify}
.krg-newsletter-form{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.krg-newsletter-input{flex:1;min-width:220px;padding:14px 20px;border-radius:8px;border:2px solid transparent;font-size:.97rem;outline:none;background:#fff;color:#0f172a;transition:border-color .2s}
.krg-newsletter-input:focus{border-color:#0f172a}
.krg-newsletter-input::placeholder{color:#94a3b8}
.krg-newsletter-btn{background:#0f172a;color:#fff;font-size:.97rem;font-weight:700;padding:14px 32px;border-radius:8px;border:none;cursor:pointer;transition:background .2s,transform .18s;white-space:nowrap}
.krg-newsletter-btn:hover{background:#1e293b;transform:translateY(-2px)}
.krg-newsletter-privacy{font-size:.78rem;color:rgba(15,23,42,.5);margin-top:16px}
.krg-footer{background:#0a1120;padding:72px 24px 40px;color:rgba(255,255,255,.6)}
.krg-footer-grid{display:grid;grid-template-columns:1.8fr 1fr 1fr 1fr;gap:48px;max-width:1180px;margin:0 auto 64px}
.krg-footer-logo{font-size:1.4rem;font-weight:900;color:#fff;text-decoration:none;letter-spacing:-.03em;display:inline-block;margin-bottom:16px}
.krg-footer-logo span{color:#e8a020}
.krg-footer-tagline{font-size:.88rem;line-height:1.7;color:rgba(255,255,255,.5);text-align:justify;margin-bottom:24px}
.krg-footer-social{display:flex;gap:12px}
.krg-social-link{width:38px;height:38px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:8px;display:flex;align-items:center;justify-content:center;text-decoration:none;font-size:1rem;transition:background .2s,border-color .2s}
.krg-social-link:hover{background:rgba(232,160,32,.2);border-color:rgba(232,160,32,.4)}
.krg-footer-col h4{font-size:.85rem;font-weight:700;color:#fff;letter-spacing:.12em;text-transform:uppercase;margin-bottom:20px}
.krg-footer-links{list-style:none;display:flex;flex-direction:column;gap:10px}
.krg-footer-links a{color:rgba(255,255,255,.5);text-decoration:none;font-size:.9rem;transition:color .2s}
.krg-footer-links a:hover{color:#e8a020}
.krg-footer-bottom{border-top:1px solid rgba(255,255,255,.08);padding-top:32px;max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.krg-footer-copy{font-size:.82rem;color:rgba(255,255,255,.35)}
.krg-footer-legal{display:flex;gap:24px}
.krg-footer-legal a{font-size:.82rem;color:rgba(255,255,255,.35);text-decoration:none;transition:color .2s}
.krg-footer-legal a:hover{color:#e8a020}
@media(max-width:1024px){.krg-footer-grid{grid-template-columns:1.5fr 1fr 1fr}.krg-footer-grid>*:last-child{grid-column:1/-1}}
@media(max-width:900px){.krg-cards-grid,.krg-trust-grid,.krg-articles-grid{grid-template-columns:1fr;max-width:480px;margin:0 auto}.krg-trust-grid{margin:64px auto 0}.krg-articles-header{flex-direction:column;align-items:flex-start}.krg-footer-grid{grid-template-columns:1fr 1fr;gap:36px}.krg-footer-grid>*:first-child{grid-column:1/-1}.krg-footer-grid>*:last-child{grid-column:auto}}
@media(max-width:640px){.krg-section{padding:64px 20px}.krg-hero{min-height:85vh;padding:60px 20px 80px}.krg-hero-stats{gap:28px}.krg-stat-num{font-size:1.6rem}.krg-newsletter-wrap{padding:48px 24px}.krg-newsletter-form{flex-direction:column}.krg-newsletter-input{min-width:unset;width:100%}.krg-newsletter-btn{width:100%}.krg-footer-grid{grid-template-columns:1fr}.krg-footer-grid>*:first-child{grid-column:auto}.krg-footer-bottom{flex-direction:column;align-items:flex-start}}
</style>
<!-- /wp:html -->

<!-- wp:html -->
<section class="krg-hero">
  <div class="krg-hero-inner">
    <div class="krg-hero-badge">&#x1F1F0;&#x1F1F7; Your Korea Companion</div>
    <h1>Your Complete Guide to<br><span>South Korea</span></h1>
    <p>Everything a foreigner needs to travel, live, and thrive in Korea — from visa applications and apartment hunting to subway maps and Korean phrases. Written by expats, for expats.</p>
    <div class="krg-hero-btns">
      <a href="/articles/" class="krg-btn-primary">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        Start Exploring
      </a>
      <a href="#categories" class="krg-btn-ghost">Browse Categories</a>
    </div>
    <div class="krg-hero-stats">
      <div class="krg-stat"><span class="krg-stat-num">200+</span><span class="krg-stat-label">In-Depth Guides</span></div>
      <div class="krg-stat"><span class="krg-stat-num" id="krg-visit-count">—</span><span class="krg-stat-label">Total Visitors</span></div>
      <div class="krg-stat"><span class="krg-stat-num">15+</span><span class="krg-stat-label">Topics Covered</span></div>
    </div>
  </div>
  <div class="krg-scroll-hint"><div class="krg-scroll-hint-line"></div>Scroll</div>
</section>
<!-- /wp:html -->

<!-- wp:html -->
<section class="krg-section krg-section-gray" id="categories">
  <div class="krg-container">
    <span class="krg-section-label">Explore by Topic</span>
    <h2 class="krg-section-title">Everything You Need, Organized for You</h2>
    <p class="krg-section-sub">Whether you're planning a trip, making the move, or learning the language, we have a dedicated guide collection for you.</p>
    <div class="krg-cards-grid">
      <a href="/category/travel-guide/" class="krg-card">
        <div class="krg-card-img-wrap">
          <img src="https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&auto=format&fit=crop&q=80" alt="Travel Guide to South Korea" loading="lazy">
          <div class="krg-card-img-overlay"></div>
          <div class="krg-card-icon">&#x2708;&#xFE0F;</div>
        </div>
        <div class="krg-card-body">
          <div class="krg-card-title">Travel Guide</div>
          <div class="krg-card-desc">Discover the best destinations, hidden gems, transportation tips, local food recommendations, and practical travel advice for exploring South Korea from north to south.</div>
          <span class="krg-card-link">Explore Travel Guides <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
        </div>
      </a>
      <a href="/category/living-in-korea/" class="krg-card">
        <div class="krg-card-img-wrap">
          <img src="https://images.unsplash.com/photo-1601628828688-632f38a5a7d0?w=800&auto=format&fit=crop&q=80" alt="Living in Korea as a Foreigner" loading="lazy">
          <div class="krg-card-img-overlay"></div>
          <div class="krg-card-icon">&#x1F3E0;</div>
        </div>
        <div class="krg-card-body">
          <div class="krg-card-title">Living in Korea</div>
          <div class="krg-card-desc">Step-by-step guides for visas, apartment rentals, health insurance, banking, registering as a foreign resident, and navigating daily life in Korea as an expat.</div>
          <span class="krg-card-link">Explore Living Guides <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
        </div>
      </a>
      <a href="/category/learn-korean/" class="krg-card">
        <div class="krg-card-img-wrap">
          <img src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&auto=format&fit=crop&q=80" alt="Learn the Korean Language" loading="lazy">
          <div class="krg-card-img-overlay"></div>
          <div class="krg-card-icon">&#x1F4DA;</div>
        </div>
        <div class="krg-card-body">
          <div class="krg-card-title">Learn Korean</div>
          <div class="krg-card-desc">From Hangul basics and essential survival phrases to grammar lessons and cultural context — our Korean language guides help you communicate with confidence from day one.</div>
          <span class="krg-card-link">Explore Korean Lessons <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span>
        </div>
      </a>
    </div>
  </div>
</section>
<!-- /wp:html -->

<!-- wp:html -->
<section class="krg-section krg-section-light">
  <div class="krg-container">
    <div class="krg-articles-header">
      <div class="krg-articles-header-left">
        <span class="krg-section-label">Fresh &amp; Updated</span>
        <h2 class="krg-section-title">Latest Articles</h2>
      </div>
      <a href="/articles/" class="krg-btn-outline">Browse All Articles <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
    </div>
    <div class="krg-articles-grid">
      {{RECENT_POSTS}}
    </div>
  </div>
</section>
<!-- /wp:html -->

<!-- wp:html -->
<section class="krg-section krg-section-dark">
  <div class="krg-container">
    <span class="krg-section-label">Our Promise</span>
    <h2 class="krg-section-title krg-section-title-light">Why KR Guide?</h2>
    <p class="krg-section-sub krg-section-sub-light">We are a team of long-term Korea residents and language enthusiasts dedicated to giving foreigners the most accurate, practical, and up-to-date information available.</p>
    <div class="krg-trust-grid">
      <div class="krg-trust-item">
        <div class="krg-trust-icon">&#x2705;</div>
        <div class="krg-trust-title">Verified &amp; Up-to-Date</div>
        <p class="krg-trust-desc">Every article is researched by people who live and work in Korea. We regularly review and update our guides to reflect the latest regulations, prices, and real-world conditions so you never get caught off guard.</p>
      </div>
      <div class="krg-trust-item">
        <div class="krg-trust-icon">&#x1F4CD;</div>
        <div class="krg-trust-title">Written by Real Expats</div>
        <p class="krg-trust-desc">Our writers are expats, English teachers, digital nomads, and long-term residents who have personally navigated Korean bureaucracy, rental markets, and daily life — and lived to tell the tale with practical wisdom.</p>
      </div>
      <div class="krg-trust-item">
        <div class="krg-trust-icon">&#x1F4AC;</div>
        <div class="krg-trust-title">Community-Driven</div>
        <p class="krg-trust-desc">KR Guide is built with feedback from thousands of foreigners in Korea. We listen to your questions, cover the topics that matter most to you, and continuously improve based on what our readers actually need on the ground.</p>
      </div>
    </div>
  </div>
</section>
<!-- /wp:html -->

<!-- wp:html -->
<section class="krg-section krg-section-gray">
  <div class="krg-container">
    <div class="krg-newsletter-wrap">
      <div class="krg-newsletter-inner">
        <h2>Stay One Step Ahead in Korea</h2>
        <p>Join over 50,000 readers who receive our weekly newsletter packed with the latest visa updates, expat tips, local events, and must-read Korea guides delivered straight to your inbox.</p>
        <form class="krg-newsletter-form" onsubmit="return false;">
          <input class="krg-newsletter-input" type="email" placeholder="Enter your email address" aria-label="Email address">
          <button class="krg-newsletter-btn" type="submit">Subscribe Free</button>
        </form>
        <p class="krg-newsletter-privacy">&#x1F512; No spam, ever. Unsubscribe anytime. We respect your privacy.</p>
      </div>
    </div>
  </div>
</section>
<!-- /wp:html -->

<!-- wp:html -->
<script>
(function(){
  const WORKER = 'https://krguide-auto-post.jssmn21.workers.dev';
  fetch(WORKER + '/api/hit', { method: 'POST' })
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById('krg-visit-count');
      if (el && d.views) el.textContent = d.views.toLocaleString();
    })
    .catch(() => {});
})();
</script>
<!-- /wp:html -->

<!-- wp:html -->
<footer class="krg-footer">
  <div class="krg-footer-grid">
    <div>
      <a href="/" class="krg-footer-logo">KR<span>Guide</span>.com</a>
      <p class="krg-footer-tagline">Your complete, community-driven guide to South Korea — covering travel, expat life, and the Korean language for foreigners from all over the world.</p>
      <div class="krg-footer-social">
        <a href="#" class="krg-social-link" aria-label="Instagram">&#x1F4F7;</a>
        <a href="#" class="krg-social-link" aria-label="YouTube">&#x1F534;</a>
        <a href="#" class="krg-social-link" aria-label="Facebook">&#x1F4D8;</a>
        <a href="#" class="krg-social-link" aria-label="Pinterest">&#x1F4CC;</a>
      </div>
    </div>
    <div class="krg-footer-col">
      <h4>Explore</h4>
      <ul class="krg-footer-links">
        <li><a href="/category/travel-guide/">Travel Guide</a></li>
        <li><a href="/category/living-in-korea/">Living in Korea</a></li>
        <li><a href="/category/learn-korean/">Learn Korean</a></li>
        <li><a href="/articles/">All Articles</a></li>
      </ul>
    </div>
    <div class="krg-footer-col">
      <h4>Essentials</h4>
      <ul class="krg-footer-links">
        <li><a href="/korea-visa-guide/">Visa Guide</a></li>
        <li><a href="/seoul-travel-guide/">Seoul Guide</a></li>
        <li><a href="/korean-phrases/">Korean Phrases</a></li>
        <li><a href="/cost-of-living-korea/">Cost of Living</a></li>
      </ul>
    </div>
    <div class="krg-footer-col">
      <h4>Company</h4>
      <ul class="krg-footer-links">
        <li><a href="/about/">About Us</a></li>
        <li><a href="/contact/">Contact</a></li>
        <li><a href="/privacy-policy/">Privacy Policy</a></li>
        <li><a href="/terms/">Terms of Use</a></li>
      </ul>
    </div>
  </div>
  <div class="krg-footer-bottom">
    <p class="krg-footer-copy">&copy; 2026 KRGuide.com &mdash; All rights reserved.</p>
    <div class="krg-footer-legal">
      <a href="/privacy-policy/">Privacy</a>
      <a href="/terms/">Terms</a>
      <a href="/sitemap.xml">Sitemap</a>
    </div>
  </div>
</footer>
<!-- /wp:html -->`;

