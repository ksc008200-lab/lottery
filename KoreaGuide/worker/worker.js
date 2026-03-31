/**
 * KR Guide — WordPress 자동 포스팅 Worker
 *
 * 환경변수 (Cloudflare Dashboard에서 Secret으로 설정):
 *   ANTHROPIC_API_KEY  — Anthropic API 키
 *   WP_APP_PASSWORD    — WordPress 애플리케이션 비밀번호
 *   WP_USERNAME        — WordPress 사용자명
 *   WP_URL             — WordPress 사이트 URL (예: https://krguide.com)
 */

// ── 단일 카테고리 집중: Travel Guide ──
const CATEGORY = "Travel Guide";
const CATEGORY_ID = 2;

const TOPICS = [
  "Best Things to Do in Busan — Korea's Second City",
  "Jeju Island Complete Travel Guide — Everything You Need to Know",
  "Korean Street Food Guide — 20 Must-Try Foods and Where to Find Them",
  "Korea Transportation Guide — Subway, Bus, KTX Explained Simply",
  "Best Day Trips from Seoul — Hidden Gems Within 2 Hours",
  "Gyeongju Travel Guide — Korea's Ancient Capital",
  "Hiking in Korea — Best Trails for Every Level",
  "Korea in Spring — Ultimate Cherry Blossom Guide",
  "DMZ Tour Guide — Visiting the Korean Demilitarized Zone",
  "Best Cafes in Seoul — A Neighborhood-by-Neighborhood Guide",
  "Namsan Seoul Tower — Complete Visitor Guide",
  "Insadong Travel Guide — Art, Culture & Shopping in Seoul",
  "Gangnam District Guide — Beyond the K-pop Cliché",
  "Korean Night Markets — Where Locals Actually Eat",
  "Sokcho & Seoraksan — Korea's Most Spectacular Mountain Escape",
];

// 카테고리별 이미지 풀 (Unsplash — Korea 관련 사진)
const IMAGE_POOL = [
  { url: "https://images.unsplash.com/photo-1538669715315-155098f0fb1d?auto=format&fit=crop&w=1200&q=80", alt: "Seoul cityscape at night" },
  { url: "https://images.unsplash.com/photo-1601621915196-2621bfb0cd6e?auto=format&fit=crop&w=1200&q=80", alt: "Busan harbor view" },
  { url: "https://images.unsplash.com/photo-1517154421773-0855edd8b751?auto=format&fit=crop&w=1200&q=80", alt: "Traditional Korean temple" },
  { url: "https://images.unsplash.com/photo-1545315003-8275394aead3?auto=format&fit=crop&w=1200&q=80", alt: "Seoul street scene" },
  { url: "https://images.unsplash.com/photo-1607863264914-71be2a5df21f?auto=format&fit=crop&w=1200&q=80", alt: "Gyeongbokgung Palace Seoul" },
  { url: "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1200&q=80", alt: "Jeju island landscape" },
  { url: "https://images.unsplash.com/photo-1583167617681-f12abbc1b5e0?auto=format&fit=crop&w=1200&q=80", alt: "Korean street food market" },
  { url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?auto=format&fit=crop&w=1200&q=80", alt: "Seoul Han River at dusk" },
];

export default {
  // 하루 3회 자동 포스팅 (KST 오전 8시, 오후 2시, 저녁 8시)
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(autoPost(env));
  },

  // 수동 테스트용 HTTP 엔드포인트
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
    // 토픽 랜덤 선택
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];

    // 이미지 랜덤 선택
    const heroImage = IMAGE_POOL[Math.floor(Math.random() * IMAGE_POOL.length)];
    const secondImage = IMAGE_POOL[Math.floor(Math.random() * IMAGE_POOL.length)];

    console.log(`Generating post: [${CATEGORY}] ${topic}`);

    // Claude로 글 생성
    const content = await generatePost(topic, heroImage, secondImage, env.ANTHROPIC_API_KEY);
    if (!content) throw new Error("Failed to generate content");

    // WordPress에 발행
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
  const systemPrompt = `You are a senior travel writer with 10+ years of living in Korea. You write for KR Guide (krguide.com), a trusted resource for foreigners traveling to or living in Korea.

Your writing style:
- Warm, engaging, and conversational — like advice from a knowledgeable friend who actually lived there
- Rich with real, specific details: prices in KRW and USD, exact transport lines, opening hours, neighborhood names
- Honest about challenges, not just promotional
- Vivid descriptions that make readers feel like they're already there

Format: Return JSON with fields:
- html: WordPress Gutenberg block format (see structure below)
- excerpt: 1-2 sentence compelling summary, max 155 characters`;

  const userPrompt = `Write a premium, deeply informative, SEO-optimized blog post about: "${topic}"

IMPORTANT VISUAL STRUCTURE — use exactly this Gutenberg block layout:

1. HERO IMAGE (full-width, at the very top):
<!-- wp:image {"align":"full","sizeSlug":"full"} -->
<figure class="wp-block-image alignfull size-full"><img src="${heroImage.url}" alt="${heroImage.alt}" /></figure>
<!-- /wp:image -->

2. INTRO paragraph (2-3 sentences, compelling hook)

3. SECTIONS — use H2 for each major section (4-6 sections):
<!-- wp:heading {"level":2} -->
<h2>Section Title</h2>
<!-- /wp:heading -->

4. SUBSECTIONS — use H3 where needed:
<!-- wp:heading {"level":3} -->
<h3>Subsection</h3>
<!-- /wp:heading -->

5. PRO TIP BOX — styled with blue background:
<!-- wp:group {"style":{"color":{"background":"#e8f4fd"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#e8f4fd;padding:24px 28px">
<!-- wp:paragraph {"style":{"typography":{"fontWeight":"700"}}} -->
<p><strong>💡 Pro Tip</strong></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>[insider tip text here]</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->

6. SECOND IMAGE (mid-article):
<!-- wp:image {"align":"wide","sizeSlug":"large"} -->
<figure class="wp-block-image alignwide size-large"><img src="${secondImage.url}" alt="${secondImage.alt}" /></figure>
<!-- /wp:image -->

7. COMMON MISTAKES BOX — styled with amber background:
<!-- wp:group {"style":{"color":{"background":"#fff8e1"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#fff8e1;padding:24px 28px">
<!-- wp:paragraph -->
<p><strong>⚠️ Common Mistakes to Avoid</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul>[list of mistakes]</ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

8. QUICK CHECKLIST — styled with green background:
<!-- wp:group {"style":{"color":{"background":"#e8f5e9"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#e8f5e9;padding:24px 28px">
<!-- wp:paragraph -->
<p><strong>✅ Quick Checklist</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul>[checklist items]</ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

9. ENCOURAGING CONCLUSION paragraph

CONTENT REQUIREMENTS:
- 1,800–2,200 words total
- Specific details: prices (KRW + USD), subway lines, neighborhood names, opening hours
- Cultural context that helps foreigners truly understand Korea
- At least one "Pro Tip" box with genuine insider knowledge
- Common mistakes foreigners make
- Practical checklist at end

Return ONLY valid JSON: { "html": "...", "excerpt": "..." }`;

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

  // JSON 파싱
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
