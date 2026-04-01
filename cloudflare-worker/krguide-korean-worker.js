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
- Every Korean word/phrase MUST follow this EXACT 4-part format — no exceptions:
  한글 (romanization) [English phonetic sound] — "English translation"
  Example: 안녕하세요 (annyeonghaseyo) [ahn-NYUNG-ha-seh-yo] — "Hello / How are you?"
- English phonetic sound = how an English speaker would pronounce it using only English syllables (e.g., "ahn-NYUNG" not IPA symbols)
- CAPITALIZE the stressed syllable in the phonetic sound
- English translation must always be in quotes and clear
- Explain how each sound compares to English: "The ㄱ sound is like the 'g' in 'go' but softer"
- For vocabulary sections, include a PICTURE VOCABULARY CARD GRID (image + Korean + phonetic + English) using Unsplash images
- Be honest about difficulty — acknowledge what's hard and give practical tips to overcome it
- Your passion for Korean language and culture must feel genuine

SEO and keyword rules:
- The exact topic title MUST appear naturally in the very first sentence
- 3–5 important keywords from the title must appear throughout — in headings, early paragraphs, mid-article, and conclusion
- Never stuff keywords — they must read naturally

Grammar rules — always explain:
- Korean word order is SOV (Subject-Object-Verb) vs English SVO — always show a comparison table
- Korean verbs go at the END of the sentence — give 3 clear English→Korean examples
- Particles (은/는, 이/가, 을/를, 에, 에서) must be explained simply with English analogies
- Basic sentence pattern: [Subject+은/는] + [Object+을/를] + [Verb] — always show this formula

Quality standard: Every lesson must contain real, usable Korean that a complete beginner (zero prior knowledge) can understand and use immediately after reading. Assume the reader has NEVER seen Korean before.`;

  const userPrompt = `Write a premium, elegant, SEO-optimized Korean language learning article for absolute beginners: "${topic}"

━━━ REQUIRED GUTENBERG BLOCK STRUCTURE ━━━

**[0] PREMIUM CSS — insert FIRST, before everything:**
<!-- wp:html -->
<style>
.kr-article p { text-align: justify; line-height: 1.95; font-size: 1.08rem; color: #1a1a2e; }
.kr-article h2 { font-size: 1.6rem; font-weight: 800; color: #1a1a2e; margin-top: 2.5rem; border-bottom: 3px solid #4f46e5; padding-bottom: 8px; }
.kr-article h3 { font-size: 1.2rem; font-weight: 700; color: #4f46e5; margin-top: 1.8rem; }
.kr-hangul { font-size: 1.5rem; font-weight: 700; color: #4f46e5; background: #f0f0ff; padding: 2px 10px; border-radius: 6px; font-family: 'Noto Sans KR', sans-serif; }
.kr-table table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
.kr-table th { background: #1a1a2e; color: #fff; padding: 12px 16px; text-align: left; }
.kr-table td { padding: 10px 16px; border-bottom: 1px solid #e8e8f0; }
.kr-table tr:nth-child(even) td { background: #f8f8ff; }
</style>
<!-- /wp:html -->

<!-- wp:html -->
<div class="kr-article">
<!-- /wp:html -->

**[1] HERO IMAGE — full width:**
<!-- wp:image {"align":"full","sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image alignfull size-full"><img src="${heroImage.url}" alt="${heroImage.alt}" /></figure>
<!-- /wp:image -->

**[2] COMPELLING INTRO — 3 paragraphs (양쪽 정렬):**
Hook absolute beginners. Make Korean feel achievable. Start from zero assumption.
<!-- wp:paragraph {"style":{"typography":{"lineHeight":"1.95"}}} -->
<p style="text-align:justify">[intro text — assume reader knows NOTHING about Korean]</p>
<!-- /wp:paragraph -->

**[3] MAIN LESSON SECTIONS — H2 for each (4-6 sections, 양쪽 정렬):**
<!-- wp:heading {"level":2} -->
<h2>Section Title</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p style="text-align:justify">[lesson content — always show: <span class="kr-hangul">한글</span> (romanization) — "meaning"]</p>
<!-- /wp:paragraph -->

**[4] EXAMPLE TABLE — premium striped style with English phonetics:**
<!-- wp:html -->
<div class="kr-table">
<table><thead><tr><th>Korean (한글)</th><th>Romanization</th><th>English Sound [phonetic]</th><th>English Meaning</th></tr></thead>
<tbody>
<tr><td>[Korean]</td><td>[romanization]</td><td>[ENG-lish pho-NET-ic]</td><td>"[meaning]"</td></tr>
</tbody></table>
</div>
<!-- /wp:html -->

**[4b] PICTURE VOCABULARY CARDS — image grid (include when topic has concrete nouns/phrases):**
<!-- wp:html -->
<style>
.kr-pic-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:16px; margin:24px 0; }
.kr-pic-card { border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.10); background:#fff; text-align:center; }
.kr-pic-card img { width:100%; height:120px; object-fit:cover; }
.kr-pic-card .kpc-body { padding:10px 8px; }
.kr-pic-card .kpc-hangul { font-size:1.3rem; font-weight:800; color:#4f46e5; font-family:'Noto Sans KR',sans-serif; }
.kr-pic-card .kpc-phonetic { font-size:0.75rem; color:#6b7280; margin:2px 0; }
.kr-pic-card .kpc-english { font-size:0.82rem; font-weight:600; color:#1a1a2e; }
</style>
<div class="kr-pic-grid">
  <div class="kr-pic-card">
    <img src="[unsplash URL for word 1]" alt="[word 1 in English]">
    <div class="kpc-body">
      <div class="kpc-hangul">[한글]</div>
      <div class="kpc-phonetic">[ENG-lish sound]</div>
      <div class="kpc-english">"[English]"</div>
    </div>
  </div>
  <!-- repeat for 6-8 vocabulary words with relevant Unsplash images -->
</div>
<!-- /wp:html -->

**[5] TEACHER'S TIP BOX — elegant indigo gradient:**
<!-- wp:group {"style":{"color":{"background":"#eef2ff"},"spacing":{"padding":{"top":"28px","bottom":"28px","left":"32px","right":"32px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background:linear-gradient(135deg,#eef2ff,#e0e7ff);padding:28px 32px;border-left:5px solid #4f46e5;border-radius:12px;box-shadow:0 2px 12px rgba(79,70,229,0.08)">
<!-- wp:paragraph -->
<p><strong style="color:#4f46e5;font-size:1.05rem">💡 Teacher's Tip</strong></p>
<!-- /wp:paragraph -->
<!-- wp:paragraph -->
<p style="text-align:justify;color:#1e1b4b">[A specific memory trick that makes this click for a complete beginner]</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->

**[6] SECOND IMAGE — wide, mid-article:**
<!-- wp:image {"align":"wide","sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image alignwide size-large"><img src="${secondImage.url}" alt="${secondImage.alt}" /></figure>
<!-- /wp:image -->

**[7] COMMON MISTAKES BOX — warm amber:**
<!-- wp:group {"style":{"color":{"background":"#fffbeb"},"spacing":{"padding":{"top":"28px","bottom":"28px","left":"32px","right":"32px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background:#fffbeb;padding:28px 32px;border-left:5px solid #f59e0b;border-radius:12px;box-shadow:0 2px 12px rgba(245,158,11,0.08)">
<!-- wp:paragraph -->
<p><strong style="color:#b45309;font-size:1.05rem">⚠️ Common Beginner Mistakes</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li>[Mistake beginners always make + clear correction]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Mistake 2 + correction]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Mistake 3 + correction]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[8] PRACTICE EXERCISES BOX — fresh green:**
<!-- wp:group {"style":{"color":{"background":"#f0fdf4"},"spacing":{"padding":{"top":"28px","bottom":"28px","left":"32px","right":"32px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background:#f0fdf4;padding:28px 32px;border-left:5px solid #22c55e;border-radius:12px;box-shadow:0 2px 12px rgba(34,197,94,0.08)">
<!-- wp:paragraph -->
<p><strong style="color:#15803d;font-size:1.05rem">✏️ Practice Now — Try These</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li>[Simple beginner exercise 1]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Exercise 2]</li><!-- /wp:list-item --><!-- wp:list-item --><li>[Exercise 3]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[9] QUICK REFERENCE BOX — deep navy premium:**
<!-- wp:group {"style":{"spacing":{"padding":{"top":"32px","bottom":"32px","left":"36px","right":"36px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px 36px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.18)">
<!-- wp:paragraph -->
<p style="color:#a5b4fc;font-weight:800;font-size:1.1rem;margin-bottom:16px">📚 Quick Reference — Remember This</p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul><!-- wp:list-item --><li style="color:#e2e8f0;margin-bottom:8px">[Key point 1]</li><!-- /wp:list-item --><!-- wp:list-item --><li style="color:#e2e8f0;margin-bottom:8px">[Key point 2]</li><!-- /wp:list-item --><!-- wp:list-item --><li style="color:#e2e8f0;margin-bottom:8px">[Key point 3]</li><!-- /wp:list-item --></ul>
<!-- /wp:list -->
</div>
<!-- /wp:group -->

**[9b] ENGLISH vs KOREAN SENTENCE STRUCTURE BOX — when grammar is relevant:**
<!-- wp:html -->
<div style="background:linear-gradient(135deg,#fdf4ff,#fae8ff);padding:28px 32px;border-left:5px solid #a855f7;border-radius:12px;box-shadow:0 2px 12px rgba(168,85,247,0.08);margin:24px 0">
  <p style="color:#7e22ce;font-weight:800;font-size:1.05rem;margin-bottom:16px">🔀 English vs Korean — How Sentences Work Differently</p>
  <table style="width:100%;border-collapse:collapse;font-size:0.92rem">
    <thead><tr>
      <th style="background:#7e22ce;color:#fff;padding:10px 14px;text-align:left">English (SVO)</th>
      <th style="background:#7e22ce;color:#fff;padding:10px 14px;text-align:left">Korean (SOV)</th>
      <th style="background:#7e22ce;color:#fff;padding:10px 14px;text-align:left">Literal Order</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:9px 14px;border-bottom:1px solid #e9d5ff">[English sentence]</td><td style="padding:9px 14px;border-bottom:1px solid #e9d5ff">[Korean sentence]</td><td style="padding:9px 14px;border-bottom:1px solid #e9d5ff">[word-by-word breakdown]</td></tr>
      <tr><td style="padding:9px 14px;border-bottom:1px solid #e9d5ff;background:#fdf4ff">[example 2]</td><td style="padding:9px 14px;border-bottom:1px solid #e9d5ff;background:#fdf4ff">[Korean]</td><td style="padding:9px 14px;border-bottom:1px solid #e9d5ff;background:#fdf4ff">[breakdown]</td></tr>
      <tr><td style="padding:9px 14px">[example 3]</td><td style="padding:9px 14px">[Korean]</td><td style="padding:9px 14px">[breakdown]</td></tr>
    </tbody>
  </table>
  <p style="color:#6b21a8;font-size:0.88rem;margin-top:12px;text-align:justify">💡 Key rule: In Korean, the <strong>verb always comes last</strong>. Unlike English (Subject → Verb → Object), Korean follows Subject → Object → Verb order. Once you internalize this, everything clicks.</p>
</div>
<!-- /wp:html -->

**[10] CONCLUSION — warm, encouraging, 2 paragraphs (양쪽 정렬)**
<!-- wp:paragraph -->
<p style="text-align:justify">[conclusion text]</p>
<!-- /wp:paragraph -->

<!-- wp:html -->
</div>
<!-- /wp:html -->

━━━ CONTENT REQUIREMENTS ━━━
- Total: 2,000–2,500 words
- ABSOLUTE BEGINNER: assume zero Korean knowledge — explain everything from scratch
- KEYWORD RULE: exact topic title "${topic}" in the first sentence
- ALL Korean must show: 한글 (romanization) — "English meaning"
- ALL paragraph text must have style="text-align:justify"
- Tables must have minimum 10 rows including English phonetic column
- PICTURE VOCABULARY CARDS: 6–8 cards with real Unsplash image URLs (format: https://images.unsplash.com/photo-XXXXX?w=400), Korean, phonetic, English
- Every Korean word: 한글 (romanization) [ENG-lish sound] — "English translation"
- End with warm encouragement — make the reader feel capable

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
