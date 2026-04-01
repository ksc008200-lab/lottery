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

// ── 토픽별 Unsplash 이미지 풀 (검증된 한국 사진 36장) ──
const TOPIC_IMAGES = {
  busan: [
    { url: "https://images.unsplash.com/photo-5ITi3WdzZ8Y?auto=format&fit=crop&w=1200&q=80", alt: "Gamcheon Culture Village colorful hillside buildings in Busan, South Korea" },
    { url: "https://images.unsplash.com/photo-oY_h_gyVZlU?auto=format&fit=crop&w=1200&q=80", alt: "Haeundae Beach aerial view at night, Busan" },
    { url: "https://images.unsplash.com/photo-AZB7cZ4RxsI?auto=format&fit=crop&w=1200&q=80", alt: "Haeundae Beach golden sandy shore, Busan South Korea" },
    { url: "https://images.unsplash.com/photo-18mvTADdIcc?auto=format&fit=crop&w=1200&q=80", alt: "Haedong Yonggungsa Temple perched on sea cliffs, Busan" },
    { url: "https://images.unsplash.com/photo-D7Gpt-yNEps?auto=format&fit=crop&w=1200&q=80", alt: "Scenic view of Busan, South Korea" },
  ],
  jeju: [
    { url: "https://images.unsplash.com/photo-ckXiImBopuo?auto=format&fit=crop&w=1200&q=80", alt: "Snowy Hallasan mountain summit, Jeju Island South Korea" },
    { url: "https://images.unsplash.com/photo-D1G2hcrkAN8?auto=format&fit=crop&w=1200&q=80", alt: "Dramatic waterfall on volcanic cliffs by the ocean, Jeju Island" },
    { url: "https://images.unsplash.com/photo-GbPHAuFQDEc?auto=format&fit=crop&w=1200&q=80", alt: "Jeju Island landscape with mountain and turquoise water" },
    { url: "https://images.unsplash.com/photo-1wsOpPr-XCI?auto=format&fit=crop&w=1200&q=80", alt: "Snow-covered trees on Hallasan mountain, Jeju" },
  ],
  palace: [
    { url: "https://images.unsplash.com/photo-G8yDww9JqY8?auto=format&fit=crop&w=1200&q=80", alt: "Visitors in traditional Korean hanbok at Gyeongbokgung Palace, Seoul" },
    { url: "https://images.unsplash.com/photo-iBryvCItpF8?auto=format&fit=crop&w=1200&q=80", alt: "Gyeongbokgung Palace illuminated at twilight, Seoul" },
    { url: "https://images.unsplash.com/photo-k78g1-JNn5A?auto=format&fit=crop&w=1200&q=80", alt: "Hyangwonjeong Pavilion reflected in palace pond, Gyeongbokgung" },
    { url: "https://images.unsplash.com/photo-WWmTo7Qd4eM?auto=format&fit=crop&w=1200&q=80", alt: "Gyeongbokgung Palace with visitors in traditional Korean attire" },
    { url: "https://images.unsplash.com/photo-T5NIVYYfynY?auto=format&fit=crop&w=1200&q=80", alt: "Gyeongbokgung Palace grand gate and courtyard, Seoul" },
  ],
  food: [
    { url: "https://images.unsplash.com/photo-e4lum8lzgYY?auto=format&fit=crop&w=1200&q=80", alt: "Bustling Korean street food stalls at traditional outdoor market" },
    { url: "https://images.unsplash.com/photo-HXeHsf9SPUQ?auto=format&fit=crop&w=1200&q=80", alt: "Lively Korean food market with vendors and diners" },
  ],
  hanok: [
    { url: "https://images.unsplash.com/photo-fwbHcgSBqx4?auto=format&fit=crop&w=1200&q=80", alt: "Traditional tiled rooftops along narrow alley in Bukchon Hanok Village, Seoul" },
    { url: "https://images.unsplash.com/photo-y1pKYx16SrE?auto=format&fit=crop&w=1200&q=80", alt: "Panoramic rooftop view of Bukchon Hanok Village traditional houses, Seoul" },
    { url: "https://images.unsplash.com/photo-KKz6NgO69yQ?auto=format&fit=crop&w=1200&q=80", alt: "Aerial golden hour view of Jeonju Hanok Village traditional rooftops" },
    { url: "https://images.unsplash.com/photo-AwlLYexpQhE?auto=format&fit=crop&w=1200&q=80", alt: "Bukchon Hanok Village with Seoul mountain backdrop" },
  ],
  spring: [
    { url: "https://images.unsplash.com/photo-mLQjqLkJ3eA?auto=format&fit=crop&w=1200&q=80", alt: "Cherry blossoms illuminating Seoul city street at night" },
    { url: "https://images.unsplash.com/photo-WQGpjSW6NA0?auto=format&fit=crop&w=1200&q=80", alt: "People celebrating cherry blossom festival under blooming trees in Korea" },
    { url: "https://images.unsplash.com/photo-MHBMClU3qCg?auto=format&fit=crop&w=1200&q=80", alt: "Seoul street scene at night with cherry blossoms in full bloom" },
    { url: "https://images.unsplash.com/photo-RYzm7LppBII?auto=format&fit=crop&w=1200&q=80", alt: "Cherry blossoms in full bloom in front of historic building, Busan" },
  ],
  temple: [
    { url: "https://images.unsplash.com/photo-ADqQgiStp4c?auto=format&fit=crop&w=1200&q=80", alt: "Bulguksa Temple ancient stone steps and architecture, Gyeongju Korea" },
    { url: "https://images.unsplash.com/photo-18mvTADdIcc?auto=format&fit=crop&w=1200&q=80", alt: "Haedong Yonggungsa Temple dramatically situated on sea rocks, Busan" },
    { url: "https://images.unsplash.com/photo-G8yDww9JqY8?auto=format&fit=crop&w=1200&q=80", alt: "Traditional Korean palace architecture with hanbok-wearing visitors" },
  ],
  namsan: [
    { url: "https://images.unsplash.com/photo-RT3a2TK1RgY?auto=format&fit=crop&w=1200&q=80", alt: "Namsan Seoul Tower rising above the city under dramatic cloudy sky" },
    { url: "https://images.unsplash.com/photo-RxWUBc0womc?auto=format&fit=crop&w=1200&q=80", alt: "N Seoul Tower iconic landmark viewed from city below" },
    { url: "https://images.unsplash.com/photo-BZG5p-u35tI?auto=format&fit=crop&w=1200&q=80", alt: "Namsan Tower overlooking Seoul cityscape and Han River" },
  ],
  seoul: [
    { url: "https://images.unsplash.com/photo-0njBEcQmbk4?auto=format&fit=crop&w=1200&q=80", alt: "Downtown Seoul glittering cityscape at night, South Korea" },
    { url: "https://images.unsplash.com/photo-Mwvhyd22Lyw?auto=format&fit=crop&w=1200&q=80", alt: "Seoul skyline illuminated at night" },
    { url: "https://images.unsplash.com/photo-01hH6y7oZFk?auto=format&fit=crop&w=1200&q=80", alt: "Aerial view of Seoul at dawn, South Korea" },
    { url: "https://images.unsplash.com/photo-zqIpyaXOrwE?auto=format&fit=crop&w=1200&q=80", alt: "Han River Seoul at night, city lights reflecting on water" },
    { url: "https://images.unsplash.com/photo-cLnd7gxOwHU?auto=format&fit=crop&w=1200&q=80", alt: "Han River bridge spanning the water in Seoul" },
  ],
  default: [
    { url: "https://images.unsplash.com/photo-gf4BctI0ubM?auto=format&fit=crop&w=1200&q=80", alt: "Seoul cityscape panoramic view, South Korea" },
    { url: "https://images.unsplash.com/photo-wp5KY3RjSGw?auto=format&fit=crop&w=1200&q=80", alt: "Seoul city with N Seoul Tower and mountain backdrop" },
    { url: "https://images.unsplash.com/photo-iBryvCItpF8?auto=format&fit=crop&w=1200&q=80", alt: "Gyeongbokgung Palace at dusk, Seoul South Korea" },
  ],
};

function getImagesForTopic(topic) {
  const t = topic.toLowerCase();
  if (t.includes("busan")) return TOPIC_IMAGES.busan;
  if (t.includes("jeju")) return TOPIC_IMAGES.jeju;
  if (t.includes("gyeongbokgung") || t.includes("palace") || t.includes("gyeongju") && t.includes("ancient")) return TOPIC_IMAGES.palace;
  if (t.includes("street food") || t.includes("food") || t.includes("market") || t.includes("eat")) return TOPIC_IMAGES.food;
  if (t.includes("hanok") || t.includes("insadong") || t.includes("bukchon") || t.includes("jeonju")) return TOPIC_IMAGES.hanok;
  if (t.includes("spring") || t.includes("cherry blossom")) return TOPIC_IMAGES.spring;
  if (t.includes("temple") || t.includes("bulguksa") || t.includes("gyeongju")) return TOPIC_IMAGES.temple;
  if (t.includes("namsan") || t.includes("tower") || t.includes("cafe") || t.includes("gangnam")) return TOPIC_IMAGES.namsan;
  if (t.includes("hiking") || t.includes("mountain") || t.includes("seoraksan") || t.includes("sokcho")) return TOPIC_IMAGES.jeju;
  if (t.includes("dmz") || t.includes("day trip") || t.includes("seoul")) return TOPIC_IMAGES.seoul;
  return TOPIC_IMAGES.default;
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

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "POST") {
      const result = await autoPost(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
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
    const imagePool = getImagesForTopic(topic);
    const [heroImage, secondImage] = pickTwo(imagePool);

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

  const userPrompt = `Write a premium, deeply informative, SEO-optimized travel guide for: "${topic}"

━━━ REQUIRED GUTENBERG BLOCK STRUCTURE ━━━

Use EXACTLY this structure. Do not deviate from these block formats.

**[1] HERO IMAGE — full width at very top:**
<!-- wp:image {"align":"full","sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image alignfull size-full"><img src="${heroImage.url}" alt="${heroImage.alt}" /></figure>
<!-- /wp:image -->

**[2] COMPELLING INTRO — 3 short paragraphs:**
Hook the reader immediately. Make them feel the place. Include 1-2 concrete facts.
<!-- wp:paragraph -->
<p>[intro text]</p>
<!-- /wp:paragraph -->

**[3] MAIN SECTIONS — use H2 for each (4-6 sections total):**
<!-- wp:heading {"level":2} -->
<h2>Section Title</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>[rich content with specific details, prices, names]</p>
<!-- /wp:paragraph -->

**[4] H3 SUBSECTIONS within sections where needed:**
<!-- wp:heading {"level":3} -->
<h3>Subsection Title</h3>
<!-- /wp:heading -->

**[5] PRO TIP BOX — blue background, after 2nd section:**
<!-- wp:group {"style":{"color":{"background":"#e8f4fd"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#e8f4fd;padding:24px 28px;border-left:4px solid #2196F3;border-radius:8px">
<!-- wp:paragraph -->
<p><strong>💡 Pro Tip</strong></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>[Genuine insider tip that standard guides miss — must be specific and actionable]</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->

**[6] SECOND IMAGE — wide, mid-article after 3rd section:**
<!-- wp:image {"align":"wide","sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image alignwide size-large"><img src="${secondImage.url}" alt="${secondImage.alt}" /></figure>
<!-- /wp:image -->

**[7] COMMON MISTAKES BOX — amber/yellow background:**
<!-- wp:group {"style":{"color":{"background":"#fff8e1"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#fff8e1;padding:24px 28px;border-left:4px solid #FFC107;border-radius:8px">
<!-- wp:paragraph -->
<p><strong>⚠️ Common Mistakes Foreigners Make</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li>[Mistake 1 with specific fix]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Mistake 2 with specific fix]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Mistake 3 with specific fix]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[8] INSIDER CULTURAL CONTEXT BOX — dark navy background:**
<!-- wp:group {"style":{"color":{"background":"#1a2744","text":"#ffffff"},"spacing":{"padding":{"top":"28px","bottom":"28px","left":"32px","right":"32px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#1a2744;color:#ffffff;padding:28px 32px;border-radius:12px">
<!-- wp:paragraph {"style":{"color":{"text":"#ffffff"}}} -->
<p style="color:#ffffff"><strong>🇰🇷 Know Before You Go — Cultural Context</strong></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph {"style":{"color":{"text":"#e0e0e0"}}} -->
<p style="color:#e0e0e0">[2-3 sentences of essential cultural context that helps foreigners understand the place/experience more deeply]</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->

**[9] QUICK REFERENCE CHECKLIST — green background:**
<!-- wp:group {"style":{"color":{"background":"#e8f5e9"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#e8f5e9;padding:24px 28px;border-left:4px solid #4CAF50;border-radius:8px">
<!-- wp:paragraph -->
<p><strong>✅ Your Complete Checklist</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li>[Checklist item 1]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Checklist item 2]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Checklist item 3]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Checklist item 4]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Checklist item 5]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[10] CONCLUSION — encouraging, 2 paragraphs:**

━━━ CONTENT REQUIREMENTS ━━━

- Total length: 2,000–2,500 words — comprehensive, in-depth, zero padding
- KEYWORD RULE #1: The exact topic title "${topic}" MUST appear naturally in the very first sentence
- KEYWORD RULE #2: 3–5 key phrases from the topic title must appear throughout: in at least one H2 heading, in an early paragraph, in a mid-article paragraph, and near the conclusion
- KEYWORD RULE #3: Never stuff keywords — every keyword placement must read naturally in context
- H2 headings: 4-6 sections with descriptive titles (include keywords where natural)
- H3 subheadings: use where content benefits from subdivision
- Prices: always show KRW and USD equivalent (e.g., "₩10,000 / ~$7.50")
- Transport: specific subway lines, exit numbers, bus routes, travel times
- Neighborhoods: use actual Korean neighborhood names (e.g., Hongdae, Itaewon, Jongno)
- Seasonal tips: mention best times to visit and what to avoid
- Must include: Pro Tip box, Mistakes box, Cultural Context box, Checklist box

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON — no markdown, no explanation outside JSON:
{ "html": "...", "excerpt": "One compelling sentence about this destination, max 155 characters." }`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in response");

  return JSON.parse(jsonMatch[0]);
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

