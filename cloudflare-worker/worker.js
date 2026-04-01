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
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (response.status === 529 || response.status === 503 || response.status === 502) {
      const wait = attempt * 15000;
      console.log(`Claude API overloaded (attempt ${attempt}/${MAX_RETRIES}), retrying in ${wait/1000}s...`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw new Error(`Claude API error: ${response.status} after ${MAX_RETRIES} attempts`);
    }

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    return JSON.parse(jsonMatch[0]);
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

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}