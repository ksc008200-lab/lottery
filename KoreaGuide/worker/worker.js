/**
 * KR Guide — WordPress 자동 포스팅 Worker
 *
 * 환경변수 (Cloudflare Dashboard에서 Secret으로 설정):
 *   ANTHROPIC_API_KEY  — Anthropic API 키
 *   WP_APP_PASSWORD    — WordPress 애플리케이션 비밀번호
 *   WP_USERNAME        — WordPress 사용자명 (예: admin_hu20is3)
 *   WP_URL             — WordPress 사이트 URL (예: https://krguide.com)
 */

// 카테고리별 토픽 풀
const CONTENT_POOL = {
  "Travel Guide": [
    "Best Things to Do in Busan — Korea's Second City",
    "Jeju Island Travel Guide — Complete Visitor's Guide",
    "Korean Street Food Guide — 20 Must-Try Foods",
    "Korea Transportation Guide — Subway, Bus, KTX",
    "Best Day Trips from Seoul",
    "Gyeongju Travel Guide — Korea's Ancient Capital",
    "Hiking in Korea — Best Trails for Beginners",
    "Korea in Spring — Cherry Blossom Guide",
    "DMZ Tour Guide — Visiting the Korean Demilitarized Zone",
    "Best Cafes in Seoul — A Neighborhood Guide",
  ],
  "Living in Korea": [
    "How to Open a Bank Account in Korea as a Foreigner",
    "Getting a SIM Card in Korea — Best Options for Foreigners",
    "Healthcare in Korea for Foreigners — How It Works",
    "Finding Housing in Korea — Jeonse, Wolse, and Monthly Rentals",
    "How to Get a Korean Driver's License",
    "Cost of Living in Korea — Monthly Budget Guide",
    "Public Transportation in Korea — T-money and Apps",
    "Working in Korea — Work Visas and Job Market",
    "Korean Grocery Shopping Guide for Foreigners",
    "Shipping and Mail in Korea — Post Office Guide",
  ],
  "Learn Korean": [
    "How to Read Korean (Hangeul) in 1 Hour",
    "Korean Numbers — Two Systems Explained Simply",
    "Korean Food Vocabulary — Order Like a Local",
    "Korean Honorifics — When to Use Formal vs Informal Speech",
    "Essential Korean Verbs for Everyday Life",
    "Korean Shopping Phrases — Bargain and Buy with Confidence",
    "Korean at the Doctor — Medical Vocabulary Guide",
    "Korean Slang — Popular Words Used by Young Koreans",
    "Korean Counters — How to Count Objects in Korean",
    "Top Apps for Learning Korean in 2026",
  ],
};

// 카테고리 WordPress ID 매핑 (WordPress에서 확인 필요)
const CATEGORY_IDS = {
  "Travel Guide": 3,
  "Living in Korea": 4,
  "Learn Korean": 5,
};

export default {
  // 하루 3회 자동 포스팅: 오전 8시, 오후 2시, 저녁 8시 (UTC 기준)
  async scheduled(event, env, ctx) {
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
    return new Response("KR Guide Auto Post Worker", { status: 200 });
  },
};

async function autoPost(env) {
  try {
    // 카테고리 순환 선택
    const categories = Object.keys(CONTENT_POOL);
    const hour = new Date().getUTCHours();
    const category = categories[Math.floor(hour / 8) % categories.length];

    // 토픽 랜덤 선택
    const topics = CONTENT_POOL[category];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    console.log(`Generating post: [${category}] ${topic}`);

    // Claude로 글 생성
    const content = await generatePost(topic, category, env.ANTHROPIC_API_KEY);
    if (!content) throw new Error("Failed to generate content");

    // WordPress에 발행
    const result = await publishToWordPress(
      {
        title: topic,
        content: content.html,
        excerpt: content.excerpt,
        category: category,
        categoryId: CATEGORY_IDS[category],
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

async function generatePost(topic, category, apiKey) {
  const systemPrompt = `You are an expert content writer for KR Guide (krguide.com), a blog for foreigners interested in Korea.
Write helpful, accurate, and engaging blog posts in English.
Category: ${category}
Format: Return JSON with fields: html (WordPress Gutenberg HTML blocks), excerpt (1-2 sentence summary, max 160 chars)`;

  const userPrompt = `Write a comprehensive, SEO-optimized blog post about: "${topic}"

Requirements:
- 600-900 words
- Use WordPress Gutenberg block format (<!-- wp:heading --> etc.)
- Include practical, actionable information
- Use headers (h2, h3), lists, and tip boxes where appropriate
- Natural, conversational tone
- End with a helpful summary or call to action

Return as JSON: { "html": "...", "excerpt": "..." }`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
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
