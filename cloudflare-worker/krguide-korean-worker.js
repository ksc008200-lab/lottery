/**
 * KR Guide — Learn Korean 자동 포스팅 Worker
 * 외국인 대상 한국어 학습 콘텐츠 자동 생성
 *
 * 환경변수 (Cloudflare Dashboard Secret):
 *   ANTHROPIC_API_KEY  — Anthropic API 키
 *   WP_APP_PASSWORD    — WordPress 애플리케이션 비밀번호
 *   WP_USERNAME        — WordPress 사용자명
 *   WP_URL             — WordPress 사이트 URL (https://krguide.com)
 */

const CATEGORY_ID = 4; // Learn Korean

const TOPICS = [
  // Step 1: Korean Alphabet (가나다라 순서)
  "Korean Alphabet ㄱ ㄴ ㄷ ㄹ — How to Pronounce Every Consonant",
  "Korean Vowels ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ — Complete Pronunciation Guide",
  "How to Read Korean Syllable Blocks — Step by Step for Beginners",
  "Korean Double Consonants ㄲ ㄸ ㅃ ㅆ ㅉ — How to Pronounce Tense Sounds",
  "Korean Compound Vowels ㅐ ㅔ ㅚ ㅟ ㅘ ㅙ ㅝ ㅞ — Pronunciation Made Easy",
  "Korean Final Consonants (받침) — How Batchim Changes Pronunciation",
  "How to Write Your Name in Korean — Hangul Transliteration Guide",
  "Korean Alphabet Song — Learn 가나다라마바사 Like a Native Child",
  "How to Read Korean in 1 Hour — Complete Beginner's Step-by-Step Guide",
  "Korean Pronunciation Rules Every Beginner Must Know",

  // Step 2: Basic Vocabulary
  "Top 50 Korean Phrases Every Beginner Must Know",
  "Korean Numbers — How to Count in Korean (Native vs Sino)",
  "How to Introduce Yourself in Korean — Beginner's Script",
  "Korean Greetings Guide — 20 Ways to Say Hello and Goodbye",
  "Essential Korean Words for Shopping in Korea",
  "How to Order Food in Korean — Restaurant Phrases That Work",
  "Korean Days of the Week, Months, and Dates Explained",
  "Korean Colors, Shapes, and Sizes — Vocabulary Guide",

  // Grammar
  "Korean Particles 은/는 vs 이/가 — The Complete Beginner's Guide",
  "Korean Verb Conjugation for Beginners — Present, Past, Future",
  "How to Use 아/어요 Endings in Korean — Polite Speech Guide",
  "Korean Sentence Structure Explained — SOV Word Order",
  "Using ~때문에 and ~아/어서 in Korean — Cause and Reason",
  "Korean Question Words — Who, What, Where, When, Why, How",
  "Honorifics in Korean — When and How to Use Formal Speech",
  "Korean Negation — How to Say No and Not in Korean",
  "How to Use Korean Connectors — ~고, ~지만, ~그래서",
  "Korean Adjectives as Verbs — Understanding Descriptive Verbs",

  // Vocabulary
  "Korean Body Parts Vocabulary — Head to Toe Guide",
  "Korean Family Members Vocabulary with Pronunciation",
  "Korean Food Vocabulary — 60 Essential Words for Foodies",
  "Korean Transportation Vocabulary — Subway, Bus, Taxi",
  "Korean Workplace Vocabulary — Office and Business Terms",
  "Korean Medical Vocabulary — How to Talk to a Doctor in Korea",
  "Korean Emotions and Feelings — Express Yourself Fluently",
  "Korean Time Expressions — Yesterday, Today, Tomorrow and More",
  "Korean Weather Vocabulary — Seasons and Climate Words",
  "Korean Animal Names in Korean — Fun Vocabulary Guide",

  // K-Drama & K-Pop
  "Most Common Korean Phrases from K-Dramas You Must Know",
  "K-Pop Korean Slang — Words You Hear in Every Song",
  "How to Understand Korean Drama Without Subtitles — Tips",
  "Korean Slang Words Used by Korean Teens in 2025",
  "BTS Lyrics Korean Lesson — Learn Korean Through Music",
  "Korean Dramas for Korean Learners — Best Shows by Level",

  // Pronunciation
  "Korean Pronunciation Rules Every Learner Gets Wrong",
  "Korean Consonant Clusters — How to Pronounce Batchim",
  "Korean Double Consonants (쌍자음) — Pronunciation Guide",
  "Korean Liaison Rules — How Words Sound Together",
  "Korean Intonation and Rhythm — Sound Like a Native",

  // TOPIK
  "TOPIK I Complete Study Guide — How to Pass on Your First Try",
  "TOPIK II Writing Section — Tips and Sample Answers",
  "TOPIK Vocabulary List — 500 Most Common Words",
  "How to Register for TOPIK Exam — Step by Step Guide",
  "TOPIK Reading Strategies — How to Score High Every Time",

  // Culture & Language
  "Korean Speech Levels Explained — Formal, Polite, Casual",
  "Why Korean Has No Spaces Between Syllables — Explained",
  "Korean Loanwords from English — Over 100 Easy Words",
  "Konglish Guide — English Words That Confuse Koreans",
  "How Long Does It Take to Learn Korean — Honest Answer",
];

const IMAGES = {
  default: [
    { url: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=1200", alt: "Korean language learning books and study materials" },
    { url: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=1200", alt: "Person studying Korean language with notebook" },
    { url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200", alt: "Korean study materials and flashcards" },
    { url: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200", alt: "Open book and language learning notes" },
    { url: "https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=1200", alt: "Writing Korean characters in notebook" },
  ],
  hangul: [
    { url: "https://images.unsplash.com/photo-1527090526205-beaac8dc3c62?w=1200", alt: "Korean Hangul alphabet characters" },
    { url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200", alt: "Korean language book with Hangul" },
  ],
  culture: [
    { url: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200", alt: "Korean traditional culture and language" },
    { url: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1200", alt: "Seoul cityscape representing Korean culture" },
  ],
};

function getImagesForTopic(topic) {
  const t = topic.toLowerCase();
  if (t.includes("hangul") || t.includes("alphabet") || t.includes("read")) return IMAGES.hangul;
  if (t.includes("culture") || t.includes("drama") || t.includes("pop")) return IMAGES.culture;
  return IMAGES.default;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickTwo(arr) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1] || shuffled[0]];
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil((async () => {
      await autoPost(env);
      await autoPost(env);
      await autoPost(env);
    })());
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/trigger" && request.method === "POST") {
      const result = await autoPost(env);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("KR Guide — Learn Korean Auto Post Worker", { status: 200 });
  },
};

async function autoPost(env) {
  try {
    const topic = pickRandom(TOPICS);
    const imagePool = getImagesForTopic(topic);
    const [heroImage, secondImage] = pickTwo(imagePool);

    console.log(`Generating post: [Learn Korean] ${topic}`);

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
  const systemPrompt = `You are an expert Korean language teacher with 15+ years of experience teaching Korean to foreigners. You write for KR Guide (krguide.com/learn-korean).

Your teaching style — non-negotiable:
- Write like a patient, encouraging teacher who has helped thousands of students learn Korean
- Every explanation is crystal clear — use real examples, comparisons to English, and memory tricks
- Use "you" directly — this is personal, practical, and encouraging
- Always show Korean script (한글) + romanization (in parentheses) + English meaning for every Korean word or phrase
- Format: 안녕하세요 (annyeonghaseyo) — "Hello/How are you?"
- Be honest about difficulty — acknowledge what's hard and give practical tips to overcome it
- Your passion for Korean language and culture must feel genuine

SEO and keyword rules:
- The exact topic title MUST appear naturally in the very first sentence
- 3–5 important keywords from the title must appear throughout — in headings, early paragraphs, mid-article, and conclusion
- Never stuff keywords — they must read naturally

Quality standard: Every lesson must contain real, usable Korean that a student can use immediately after reading.`;

  const userPrompt = `Write a premium, comprehensive, SEO-optimized Korean language learning article for: "${topic}"

━━━ REQUIRED GUTENBERG BLOCK STRUCTURE ━━━

**[1] HERO IMAGE — full width:**
<!-- wp:image {"align":"full","sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image alignfull size-full"><img src="${heroImage.url}" alt="${heroImage.alt}" /></figure>
<!-- /wp:image -->

**[2] COMPELLING INTRO — 3 paragraphs:**
Hook the reader. Make them excited to learn. Include a motivating fact about Korean.
<!-- wp:paragraph -->
<p>[intro text]</p>
<!-- /wp:paragraph -->

**[3] MAIN LESSON SECTIONS — H2 for each (4-6 sections):**
<!-- wp:heading {"level":2} -->
<h2>Section Title</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>[lesson content with Korean examples: 한글 (romanization) — "meaning"]</p>
<!-- /wp:paragraph -->

**[4] EXAMPLE TABLE where applicable:**
<!-- wp:table {"className":"is-style-stripes"} -->
<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>Korean</th><th>Romanization</th><th>English</th></tr></thead><tbody><tr><td>[Korean]</td><td>[romanization]</td><td>[meaning]</td></tr></tbody></table></figure>
<!-- /wp:table -->

**[5] PRO TIP BOX — blue background:**
<!-- wp:group {"style":{"color":{"background":"#e8f4fd"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#e8f4fd;padding:24px 28px;border-left:4px solid #2196F3;border-radius:8px">
<!-- wp:paragraph -->
<p><strong>💡 Teacher's Tip</strong></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p>[A specific memory trick or insider teaching tip that makes this click]</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->

**[6] SECOND IMAGE — wide, mid-article:**
<!-- wp:image {"align":"wide","sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image alignwide size-large"><img src="${secondImage.url}" alt="${secondImage.alt}" /></figure>
<!-- /wp:image -->

**[7] COMMON MISTAKES BOX — amber background:**
<!-- wp:group {"style":{"color":{"background":"#fff8e1"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#fff8e1;padding:24px 28px;border-left:4px solid #FFC107;border-radius:8px">
<!-- wp:paragraph -->
<p><strong>⚠️ Common Mistakes Learners Make</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li>[Mistake 1 with correction]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Mistake 2 with correction]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Mistake 3 with correction]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[8] PRACTICE EXERCISES BOX — green background:**
<!-- wp:group {"style":{"color":{"background":"#e8f5e9"},"spacing":{"padding":{"top":"24px","bottom":"24px","left":"28px","right":"28px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#e8f5e9;padding:24px 28px;border-left:4px solid #4CAF50;border-radius:8px">
<!-- wp:paragraph -->
<p><strong>✏️ Practice Exercises</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li>[Exercise 1]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Exercise 2]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Exercise 3]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[9] QUICK REFERENCE BOX — dark navy background:**
<!-- wp:group {"style":{"color":{"background":"#1a2744","text":"#ffffff"},"spacing":{"padding":{"top":"28px","bottom":"28px","left":"32px","right":"32px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background-color:#1a2744;color:#ffffff;padding:28px 32px;border-radius:12px">
<!-- wp:paragraph {"style":{"color":{"text":"#ffffff"}}} -->
<p style="color:#ffffff"><strong>📚 Quick Reference — Key Points</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li style="color:#e0e0e0">[Key point 1]</li><!-- /wp:list-item --><!-- wp:list-item --><li style="color:#e0e0e0">[Key point 2]</li><!-- /wp:list-item --><!-- wp:list-item --><li style="color:#e0e0e0">[Key point 3]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[10] CONCLUSION — encouraging, 2 paragraphs**

━━━ CONTENT REQUIREMENTS ━━━
- Total: 2,000–2,500 words
- KEYWORD RULE: The exact topic title "${topic}" in the first sentence
- Always format Korean: 한글 (romanization) — "English meaning"
- Include real, usable example sentences
- Tables for vocabulary lists (minimum 8 rows)
- Prices/resources where relevant
- End with encouragement to keep studying

━━━ OUTPUT FORMAT ━━━
Return ONLY valid JSON:
{ "html": "...", "excerpt": "One compelling sentence about this lesson, max 155 characters." }`;

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
      console.log(`Claude API overloaded (attempt ${attempt}/${MAX_RETRIES}), retrying in ${wait / 1000}s...`);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, wait));
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
