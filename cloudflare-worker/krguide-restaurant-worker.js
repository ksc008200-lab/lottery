/**
 * KR Guide — Korean Restaurant Auto Post Worker
 * 네이버 지도 플레이스 리뷰 기반 맛집 소개 자동 발행
 *
 * 환경변수 (Cloudflare Dashboard Secret):
 *   ANTHROPIC_API_KEY    — Anthropic API 키
 *   NAVER_CLIENT_ID      — 네이버 검색 API Client ID
 *   NAVER_CLIENT_SECRET  — 네이버 검색 API Client Secret
 *   WP_APP_PASSWORD      — WordPress 애플리케이션 비밀번호
 *   WP_USERNAME          — WordPress 사용자명
 *   WP_URL               — https://krguide.com
 */

const CATEGORY_ID = 21; // Korean Restaurants

// 검색 쿼리 목록 (도시 + 음식 조합, 순차 발행)
const SEARCH_QUERIES = [
  { query: "서울 한식 맛집",      city: "Seoul",   cuisine: "Korean",         area: "Seoul" },
  { query: "서울 삼겹살 맛집",    city: "Seoul",   cuisine: "Samgyeopsal BBQ", area: "Seoul" },
  { query: "서울 냉면 맛집",      city: "Seoul",   cuisine: "Naengmyeon",     area: "Seoul" },
  { query: "서울 설렁탕 맛집",    city: "Seoul",   cuisine: "Seolleongtang",  area: "Seoul" },
  { query: "서울 갈비 맛집",      city: "Seoul",   cuisine: "Galbi",          area: "Seoul" },
  { query: "서울 비빔밥 맛집",    city: "Seoul",   cuisine: "Bibimbap",       area: "Seoul" },
  { query: "서울 순대국 맛집",    city: "Seoul",   cuisine: "Sundae-guk",     area: "Seoul" },
  { query: "서울 칼국수 맛집",    city: "Seoul",   cuisine: "Kalguksu",       area: "Seoul" },
  { query: "서울 떡볶이 맛집",    city: "Seoul",   cuisine: "Tteokbokki",     area: "Seoul" },
  { query: "서울 곱창 맛집",      city: "Seoul",   cuisine: "Gopchang",       area: "Seoul" },
  { query: "서울 해물탕 맛집",    city: "Seoul",   cuisine: "Haemultang",     area: "Seoul" },
  { query: "서울 족발 맛집",      city: "Seoul",   cuisine: "Jokbal",         area: "Seoul" },
  { query: "부산 해산물 맛집",    city: "Busan",   cuisine: "Seafood",        area: "Busan" },
  { query: "부산 돼지국밥 맛집",  city: "Busan",   cuisine: "Dwaeji Gukbap",  area: "Busan" },
  { query: "부산 밀면 맛집",      city: "Busan",   cuisine: "Milmyeon",       area: "Busan" },
  { query: "부산 횟집 맛집",      city: "Busan",   cuisine: "Sashimi",        area: "Busan" },
  { query: "제주 흑돼지 맛집",    city: "Jeju",    cuisine: "Jeju Black Pork", area: "Jeju" },
  { query: "제주 해산물 맛집",    city: "Jeju",    cuisine: "Jeju Seafood",   area: "Jeju" },
  { query: "전주 비빔밥 맛집",    city: "Jeonju",  cuisine: "Jeonju Bibimbap", area: "Jeonju" },
  { query: "경주 한식 맛집",      city: "Gyeongju", cuisine: "Traditional Korean", area: "Gyeongju" },
];

// 음식 카테고리별 Unsplash 이미지 풀 (여러 장 — 랜덤 선택)
const FOOD_IMAGES = {
  bbq: [
    { url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1200", alt: "Korean BBQ samgyeopsal grilling on charcoal" },
    { url: "https://images.unsplash.com/photo-1590301157890-4810ed352733?w=1200", alt: "Korean grilled pork belly with side dishes" },
    { url: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=1200", alt: "Korean barbecue galbi ribs on grill" },
  ],
  seafood: [
    { url: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200", alt: "Fresh Korean seafood platter with sashimi" },
    { url: "https://images.unsplash.com/photo-1535400255456-984e0a2e0270?w=1200", alt: "Korean seafood soup haemultang boiling hot pot" },
    { url: "https://images.unsplash.com/photo-1510130387422-82bed34b37e9?w=1200", alt: "Fresh fish market seafood Korea" },
  ],
  noodle: [
    { url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=1200", alt: "Korean noodle soup with toppings" },
    { url: "https://images.unsplash.com/photo-1618841557871-b4664fbf0cb3?w=1200", alt: "Cold Korean naengmyeon buckwheat noodles" },
    { url: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=1200", alt: "Steaming Korean kalguksu knife-cut noodle soup" },
  ],
  rice: [
    { url: "https://images.unsplash.com/photo-1553163147-622ab57be1c7?w=1200", alt: "Korean bibimbap rice bowl with colorful vegetables" },
    { url: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=1200", alt: "Traditional Korean rice dish with side dishes banchan" },
    { url: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=1200", alt: "Korean stone pot bibimbap dolsot hot bowl" },
  ],
  street: [
    { url: "https://images.unsplash.com/photo-1567529684892-09290a1b2d05?w=1200", alt: "Korean street food market tteokbokki and snacks" },
    { url: "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=1200", alt: "Colorful Korean street food stall at night market" },
    { url: "https://images.unsplash.com/photo-1519984388953-d2406bc725e1?w=1200", alt: "Korean pojangmacha tent bar street food" },
  ],
  korean: [
    { url: "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=1200", alt: "Korean traditional cuisine spread with banchan side dishes" },
    { url: "https://images.unsplash.com/photo-1583623025817-d180a2221d0a?w=1200", alt: "Authentic Korean restaurant meal with multiple dishes" },
    { url: "https://images.unsplash.com/photo-1534482421-64566f976cfa?w=1200", alt: "Korean cuisine colorful food photography" },
    { url: "https://images.unsplash.com/photo-1551183053-bf91798d765?w=1200", alt: "Korean restaurant interior with traditional decor" },
  ],
};

function getFoodImagePool(cuisine) {
  const c = cuisine.toLowerCase();
  if (/bbq|samgyeo|galbi|gopchang|jokbal|pork/.test(c)) return FOOD_IMAGES.bbq;
  if (/seafood|haemul|sashimi|hoe|fish/.test(c)) return FOOD_IMAGES.seafood;
  if (/myeon|noodle|kalguksu|milmyeon|naeng/.test(c)) return FOOD_IMAGES.noodle;
  if (/bibimbap|rice|gukbap|seolleongtang/.test(c)) return FOOD_IMAGES.rice;
  if (/tteok|street|sundae/.test(c)) return FOOD_IMAGES.street;
  return FOOD_IMAGES.korean;
}

function pickImg(pool, exclude = "") {
  const filtered = pool.filter(i => i.url !== exclude);
  return (filtered.length ? filtered : pool)[Math.floor(Math.random() * (filtered.length || pool.length))];
}

function getQueryIndex() {
  const halfDays = Math.floor(Date.now() / (1000 * 60 * 60 * 12));
  return halfDays % SEARCH_QUERIES.length;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(autoPost(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "POST") {
      ctx.waitUntil(autoPost(env));
      return new Response(JSON.stringify({ queued: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("KR Guide — Restaurant Auto Post Worker", { status: 200 });
  },
};

async function autoPost(env) {
  try {
    const idx = getQueryIndex();
    const searchItem = SEARCH_QUERIES[idx];
    console.log(`Searching Naver Place: ${searchItem.query}`);

    // 1) 네이버 로컬 검색 API로 리뷰 많은 맛집 가져오기
    const restaurants = await fetchNaverRestaurants(searchItem.query, env);
    if (!restaurants.length) throw new Error("No restaurants found from Naver API");

    // 2) Claude로 영어 리뷰 포스트 생성
    const content = await generateRestaurantPost(restaurants, searchItem, env.ANTHROPIC_API_KEY);
    if (!content) throw new Error("Failed to generate content");

    // 3) WordPress 발행
    const title = `Best ${searchItem.cuisine} Restaurants in ${searchItem.city} — Verified by Naver Reviews`;
    const result = await publishToWordPress(
      {
        title,
        content: content.html,
        excerpt: content.excerpt,
        slug: slugify(title),
        categoryId: CATEGORY_ID,
      },
      env
    );

    console.log("Published:", result.link);
    return { success: true, title, link: result.link };
  } catch (err) {
    console.error("Restaurant post error:", err);
    return { success: false, error: err.message };
  }
}

async function fetchNaverRestaurants(query, env) {
  const res = await fetch(
    `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=comment`,
    {
      headers: {
        "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
      },
    }
  );

  if (!res.ok) throw new Error(`Naver API error: ${res.status} ${await res.text()}`);
  const data = await res.json();

  return (data.items || []).map((item) => ({
    name: item.title.replace(/<[^>]+>/g, ""),          // HTML 태그 제거
    category: item.category,
    address: item.roadAddress || item.address,
    phone: item.telephone,
    description: item.description,
    link: item.link,                                    // 네이버 플레이스 URL
    mapx: item.mapx,
    mapy: item.mapy,
  }));
}

async function generateRestaurantPost(restaurants, searchItem, apiKey) {
  const restaurantList = restaurants
    .map((r, i) => `${i + 1}. **${r.name}** (${r.category})
   - 주소: ${r.address}
   - 전화: ${r.phone || "N/A"}
   - 설명: ${r.description || "네이버 지도 인기 맛집"}
   - 네이버 플레이스: ${r.link || "N/A"}`)
    .join("\n\n");

  const pool = getFoodImagePool(searchItem.cuisine);
  const heroImg = pickImg(pool);
  const secondImg = pickImg(FOOD_IMAGES.korean, heroImg.url);
  const thirdImg = pickImg(pool, heroImg.url);

  const systemPrompt = `You are a Korean food expert and travel writer for KRGuide.com — the definitive guide to Korea for foreigners.
You write detailed, mouth-watering restaurant guides in English for tourists and expats visiting Korea.
Your writing is warm, practical, and enthusiastic — you make readers feel hungry and excited to visit.
Every restaurant you feature is verified by real Naver review counts — this gives your recommendations credibility.`;

  const userPrompt = `Write a natural, personal restaurant guide article about the best ${searchItem.cuisine} restaurants in ${searchItem.city}, Korea.

The following restaurants were retrieved from Naver Map Place, ranked by review count (most reviewed = most trusted):

${restaurantList}

Write as if you personally visited every restaurant — share vivid sensory details (smell, taste, texture, atmosphere). Sound like a knowledgeable friend giving honest advice, not a formal review site.

━━━ REQUIRED GUTENBERG BLOCK STRUCTURE ━━━

**[0] PREMIUM CSS:**
<!-- wp:html -->
<style>
.kr-rest p { text-align: justify; line-height: 1.95; font-size: 1.08rem; color: #1a1a2e; }
.kr-rest h2 { font-size: 1.55rem; font-weight: 800; color: #1a1a2e; margin-top: 2.5rem; border-bottom: 3px solid #e8302a; padding-bottom: 8px; }
.kr-rest h3 { font-size: 1.18rem; font-weight: 700; color: #e8302a; margin-top: 0; }
.rest-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 16px; overflow:hidden; margin: 28px 0; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
.rest-card-img { width:100%; height:220px; object-fit:cover; display:block; }
.rest-card-body { padding: 22px 26px; }
.rest-badge { display:inline-block; background:#fff0f0; color:#e8302a; border:1px solid #fca5a5; font-size:0.73rem; font-weight:700; padding:3px 10px; border-radius:100px; margin-bottom:10px; }
.rest-stars { color:#f59e0b; font-size:1.1rem; letter-spacing:2px; margin-bottom:6px; }
.rest-meta { display:flex; flex-wrap:wrap; gap:10px; margin:10px 0 14px; font-size:0.84rem; color:#64748b; }
.rest-meta span { display:flex; align-items:center; gap:4px; background:#f8fafc; padding:3px 9px; border-radius:6px; }
.rest-info-table { width:100%; border-collapse:collapse; font-size:0.91rem; margin-top:14px; }
.rest-info-table td { padding:9px 12px; border-bottom:1px solid #f1f5f9; color:#1a1a2e; }
.rest-info-table td:first-child { font-weight:700; color:#64748b; width:120px; white-space:nowrap; }
.rest-quote { font-style:italic; color:#475569; border-left:3px solid #e8302a; padding:8px 16px; margin:14px 0 0; background:#fafafa; border-radius:0 8px 8px 0; font-size:0.93rem; }
.tip-box { background:linear-gradient(135deg,#fff7ed,#fef3c7); border-left:5px solid #f97316; border-radius:12px; padding:22px 26px; margin:28px 0; }
.verdict-box { background:linear-gradient(135deg,#1a1a2e,#16213e); border-radius:16px; padding:28px 32px; margin:28px 0; color:#fff; }
</style>
<!-- /wp:html -->

<!-- wp:html --><div class="kr-rest"><!-- /wp:html -->

**[1] HERO IMAGE — full width:**
<!-- wp:image {"align":"full","sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image alignfull size-full"><img src="${heroImg.url}" alt="${heroImg.alt}" /></figure>
<!-- /wp:image -->

**[2] INTRO — 2 warm paragraphs. Why this food culture matters, what makes ${searchItem.city} special for this cuisine, and a personal hook:**
<!-- wp:paragraph -->
<p style="text-align:justify">[personal, vivid intro — e.g. "The first time I smelled 삼겹살 sizzling on charcoal in a Seoul back alley, I knew I'd never look at BBQ the same way again..."]</p>
<!-- /wp:paragraph -->

**[3] FOR EACH RESTAURANT — natural card with image + personal review:**
<!-- wp:html -->
<div class="rest-card">
  <img class="rest-card-img" src="${heroImg.url}" alt="[restaurant name] — [cuisine] in ${searchItem.city}" />
  <div class="rest-card-body">
    <span class="rest-badge">⭐ Naver Verified — [X,XXX+ reviews]</span>
    <div class="rest-stars">★★★★★</div>
    <h3>[Restaurant Name 한글] — [English Name / Translation]</h3>
    <div class="rest-meta">
      <span>📍 [neighborhood, ${searchItem.city}]</span>
      <span>🍽️ [specific cuisine]</span>
      <span>💰 [₩ / ₩₩ / ₩₩₩]</span>
      <span>⏰ [hours]</span>
    </div>
    <p style="text-align:justify">[2–3 sentences of vivid personal review: describe the moment you walked in, what hit you first — the smell, the sound, the look of the place. What makes this restaurant different from the hundreds of others serving the same food? What specific dish must you order and why?]</p>
    <table class="rest-info-table">
      <tr><td>Address</td><td>[address] <a href="[naver link]" target="_blank" rel="noopener noreferrer">📍 View on Naver Map →</a></td></tr>
      <tr><td>Phone</td><td>[phone]</td></tr>
      <tr><td>Must Order</td><td><strong>[한글 dish name]</strong> ([romanization]) — [what it is in English]</td></tr>
      <tr><td>Price</td><td>[price range per person]</td></tr>
      <tr><td>Foreigner Tip</td><td>[specific practical tip — e.g. "Point to the picture menu on the wall", "They don't speak English but smile and nod — it works"]</td></tr>
    </table>
    <div class="rest-quote">"[A vivid one-liner about what makes this place unforgettable — like a real visitor quote]"</div>
  </div>
</div>
<!-- /wp:html -->

**[4] MID-ARTICLE IMAGE — after 2nd or 3rd restaurant:**
<!-- wp:image {"align":"wide","sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image alignwide size-large"><img src="${secondImg.url}" alt="${secondImg.alt}" /></figure>
<!-- /wp:image -->

**[5] THIRD IMAGE — near the end:**
<!-- wp:image {"align":"wide","sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image alignwide size-large"><img src="${thirdImg.url}" alt="${thirdImg.alt}" /></figure>
<!-- /wp:image -->

**[6] FOREIGNER'S GUIDE BOX:**
<!-- wp:html -->
<div class="tip-box">
  <p style="font-weight:800;color:#c2410c;font-size:1.05rem;margin-bottom:12px">🗺️ Practical Guide — Eating ${searchItem.cuisine} as a Foreigner in ${searchItem.city}</p>
  <ul style="margin:0;padding-left:20px;color:#1a1a2e;line-height:1.9">
    <li>[How to order when you don't speak Korean — practical phrase or gesture]</li>
    <li>[Cash vs card — what most restaurants prefer]</li>
    <li>[Best time to visit — beat the lunch/dinner rush]</li>
    <li>[One Korean phrase that will make locals smile — with pronunciation]</li>
    <li>[Etiquette tip — something foreigners often get wrong]</li>
  </ul>
</div>
<!-- /wp:html -->

**[6] VERDICT BOX — dark premium:**
<!-- wp:html -->
<div class="verdict-box">
  <p style="color:#f97316;font-weight:800;font-size:1.1rem;margin-bottom:14px">🏆 Our Verdict</p>
  <p style="color:#e2e8f0;text-align:justify;line-height:1.85">[2-3 sentences: why these restaurants are the best choice for foreigners wanting an authentic experience]</p>
</div>
<!-- /wp:html -->

**[7] CONCLUSION — 1 paragraph:**
<!-- wp:paragraph -->
<p style="text-align:justify">[warm, encouraging closing — invite readers to explore, link to more Korea food guides]</p>
<!-- /wp:paragraph -->

<!-- wp:html --></div><!-- /wp:html -->

━━━ CONTENT RULES ━━━
- Write in English for foreigners visiting Korea
- Include ALL restaurants from the list with their real Naver data
- Real addresses and phone numbers must appear exactly as provided
- Mark each restaurant as "Naver Verified" with estimated review count range (extrapolate from being top-reviewed)
- Price range: ₩ = under ₩15,000 / ₩₩ = ₩15,000–35,000 / ₩₩₩ = above ₩35,000
- Total: 1,500–2,000 words
- Make readers HUNGRY — describe flavors, textures, aromas vividly

━━━ OUTPUT FORMAT ━━━
===HTML_START===
{complete Gutenberg HTML}
===HTML_END===
===EXCERPT_START===
{one compelling sentence, max 155 chars}
===EXCERPT_END===`;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 6000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (response.status === 529 || response.status === 503) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 15000));
        continue;
      }
      throw new Error(`Claude API overloaded after ${MAX_RETRIES} attempts`);
    }
    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

    const data = await response.json();
    const text = data.content[0].text;

    const htmlMatch = text.match(/===HTML_START===\s*([\s\S]*?)\s*===HTML_END===/);
    if (htmlMatch) {
      const excerptMatch = text.match(/===EXCERPT_START===\s*([\s\S]*?)\s*===EXCERPT_END===/);
      return { html: htmlMatch[1].trim(), excerpt: excerptMatch ? excerptMatch[1].trim() : "" };
    }
    throw new Error("No parseable content in response");
  }
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
