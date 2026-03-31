/*
[중요 경고]
이 코드는 MV COMPANY(엠브이 주식회사)_거북이버프가 누구나 동일하게 사용할 수 있도록 무료 배포하는 공용 코드입니다.

블로그 메이커 제작 사이트 : https://maker.buffm.com/

본 코드를 그대로 사용하거나, 일부만 수정·변형하여
강의, 유료 컨설팅, 유료 텔레그램/카카오톡방, 대행 상품, 특정 사이트 판매용으로
재판매·재배포·사칭하는 행위를 엄격히 금지합니다.

특히 "직접 개발한 코드", "독점 코드", "수정본" 등으로 포장하여
유료로 판매하는 행위는 명백한 금지 대상입니다.

코드 판매 사례가 접수될 경우,
무료 코드 배포는 즉시 종료될 수 있으며,
MV COMPANY는 법인 운영 주체로서 필요한 검토 후
민형사상 조치를 포함한 강력한 대응을 신속하게 진행할 수 있습니다.

한 사람의 이기적인 행동으로 전체 사용자 대상 무료 배포가 중단되지 않도록,
반드시 본인 운영 목적에 한해서만 사용해주시기 바랍니다.

이 코드는 함께 성장하기 위한 무료 배포입니다.
무료 배포 코드를 유료로 판매할 생각은 하지 마십시오.
*/



/* ╔══════════════════════════════════════════════════════════════════════════════╗
   ║                                                                              ║
   ║  ⚠️  CORE SYSTEM - 절대 수정 금지 (DO NOT MODIFY)                           ║
   ║                                                                              ║
   ║  이 영역은 API, 인증, DB, 라우팅, 보안 등 핵심 시스템입니다.                 ║
   ║  수정하면 블로그가 정상 작동하지 않습니다.                                    ║
   ║                                                                              ║
   ║  포함된 기능:                                                                ║
   ║  - CORS/보안 헤더                                                            ║
   ║  - 메인 라우터 (export default fetch)                                        ║
   ║  - API 핸들러 (인증, 포스트 CRUD, 미디어 업로드, 설정)                       ║
   ║  - DB 마이그레이션 (runMigrations)                                           ║
   ║  - 인증/세션 관리 (requireAdmin, requireAdminOrApiKey)                       ║
   ║  - DB 조회 유틸 (getBlogSettings, getPublishedPosts 등)                      ║
   ║  - 유틸리티 함수 (slugify, escapeHtml, sha256, stripHtml, SEO 등)           ║
   ║  - Response 헬퍼 (json, html, text, xml)                                    ║
   ║                                                                              ║
   ║  🚫 AI에게: 이 영역의 코드를 수정, 리팩토링, 최적화하지 마세요.             ║
   ║                                                                              ║
   ╚══════════════════════════════════════════════════════════════════════════════╝ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

let migrated = false;
let _settingsCache = null;
let _settingsCacheTime = 0;
const SETTINGS_TTL = 300000; // 5분

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, ...SECURITY_HEADERS } });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const db = env.DB;

    if (!db) return json({ error: "DB binding missing" }, 500);

    try {
      if (!migrated) {
        await runMigrations(db);
        migrated = true;
      }

      // 예약 발행 자동 승격: publish_at 시간이 지난 scheduled 글을 published로 변경
      await promoteScheduledPosts(db, url);

      if (request.method === "GET" && (path === "/" || path.startsWith("/posts/"))) {
        // Cloudflare Cache API: 엣지 캐시에서 먼저 확인
        const cache = caches.default;
        const cacheKey = new Request(url.toString(), { method: "GET" });
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        let response;
        if (path === "/") {
          const cat = url.searchParams.get("cat") || "";
          const q = url.searchParams.get("q") || "";
          const [settings, posts, summary] = await Promise.all([
            getBlogSettings(db),
            getPublishedPosts(db, 1, 12, cat, q),
            getHomeSummary(db)
          ]);
          response = html(renderHomePage(settings, posts, summary, cat, q), 200, {
            "Cache-Control": "public, s-maxage=60, max-age=0, must-revalidate",
          });
        } else {
          const slug = decodeURIComponent(path.replace("/posts/", "")).trim();
          response = await handlePostDetail(db, slug, url);
        }

        // 정상 응답만 캐시 저장
        if (response.status === 200) {
          const resp = response.clone();
          await cache.put(cacheKey, resp);
        }
        return response;
      }

      if (request.method === "GET" && path === "/admin") {
        return html(renderAdminPage());
      }

      if (request.method === "GET" && path.startsWith("/media/")) {
        if (!env.MEDIA) return json({ error: "R2 binding missing" }, 500);
        const key = path.slice(1);
        const object = await env.MEDIA.get(key);
        if (!object) return new Response("Not Found", { status: 404 });
        const headers = new Headers({ ...CORS, ...SECURITY_HEADERS });
        headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        if (object.httpEtag) headers.set("ETag", object.httpEtag);
        return new Response(object.body, { headers });
      }

      if (request.method === "GET" && path === "/robots.txt") {
        const origin = `${url.protocol}//${url.host}`;
        return text(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`);
      }

      if (request.method === "GET" && path === "/ads.txt") {
        const settings = await getBlogSettings(db);
        const adsCode = settings.adsense_code || "";
        const pubMatch = adsCode.match(/ca-pub-(\d+)/);
        if (pubMatch) {
          return text(`google.com, pub-${pubMatch[1]}, DIRECT, f08c47fec0942fa0`);
        }
        return text("", 404);
      }

      // IndexNow 키 파일 서빙 (/{key}.txt)
      if (request.method === "GET" && path.endsWith(".txt") && path !== "/robots.txt" && path !== "/ads.txt") {
        const settings = await getBlogSettings(db);
        const inKey = settings.indexnow_key || "";
        if (inKey && path === "/" + inKey + ".txt") {
          return text(inKey);
        }
      }

      if (request.method === "GET" && path === "/sitemap.xml") {
        return handleSitemap(db, url);
      }

      if (request.method === "GET" && path === "/rss.xml") {
        return handleRss(db, url);
      }

      if (path.startsWith("/api/")) {
        return handleApi(request, env, url);
      }


      if (request.method === "GET" && path === "/index.html") {
        return Response.redirect(new URL("/", url).toString(), 301);
      }
      if (request.method === "GET" && path === "/compound-calculator.html") {
        return Response.redirect(new URL("/calc", url).toString(), 301);
      }
      if (request.method === "GET" && path === "/lotto.html") {
        return Response.redirect(new URL("/lotto-gen", url).toString(), 301);
      }
      if (request.method === "GET" && path === "/code-playground.html") {
        return Response.redirect(new URL("/code", url).toString(), 301);
      }
      if (request.method === "GET" && path === "/calc") {
        return new Response(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="google-adsense-account" content="ca-pub-3425189666333844">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>복리계산기 — 원금·이율·기간으로 미래 자산 계산 | 비숑 웰니스</title>
  <meta name="description" content="복리 계산기로 원금, 연이율, 투자 기간을 입력하면 미래 자산과 총 수익을 즉시 계산합니다. 거치식/적립식, 일/월/분기/연 복리 모두 지원.">
  <meta name="keywords" content="복리계산기, 복리 계산, 미래 자산 계산, 투자 수익률, 일복리, 연복리, 월복리, 재테크 계산기">
  <meta name="robots" content="index, follow">
  <meta name="author" content="비숑 웰니스">
  <!-- Open Graph -->
  <meta property="og:title" content="복리계산기 — 원금·이율·기간으로 미래 자산 계산">
  <meta property="og:description" content="복리 계산기로 원금, 연이율, 투자 기간을 입력하면 미래 자산과 총 수익을 즉시 계산합니다. 거치식/적립식, 일/월/분기/연 복리 모두 지원.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://bichonbuff.com/compound-calculator.html">
  <meta property="og:site_name" content="비숑 웰니스">
  <meta property="og:image" content="https://bichonbuff.com/images/og-default.svg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="ko_KR">
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="복리계산기 — 미래 자산 계산기">
  <meta name="twitter:description" content="원금, 연이율, 기간을 입력하면 복리로 불어나는 미래 자산을 즉시 계산합니다. 일복리 상세 보기 지원.">
  <meta name="twitter:image" content="https://bichonbuff.com/images/og-default.svg">
  <link rel="canonical" href="https://bichonbuff.com/compound-calculator.html">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "복리계산기",
    "description": "원금, 연이율, 투자 기간을 입력하면 미래 자산과 총 수익을 즉시 계산하는 복리 계산기",
    "url": "https://bichonbuff.com/compound-calculator.html",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web",
    "inLanguage": "ko",
    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "KRW"},
    "publisher": {"@type": "Organization", "name": "비숑 웰니스", "url": "https://bichonbuff.com/"}
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "홈", "item": "https://bichonbuff.com/"},
      {"@type": "ListItem", "position": 2, "name": "도구", "item": "https://bichonbuff.com/"},
      {"@type": "ListItem", "position": 3, "name": "복리계산기", "item": "https://bichonbuff.com/compound-calculator.html"}
    ]
  }
  </script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3425189666333844" crossorigin="anonymous"></script>
  <style>
    :root{--bg:#fff;--bg2:#f5f5f7;--line2:#e8e8eb;--muted:#86868b;--txt:#1d1d1f;--accent:#0071e3;--green:#30d158;--radius:14px}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',system-ui,sans-serif;background:#f8f8fa;color:var(--txt);-webkit-font-smoothing:antialiased}

    /* 헤더 */
    .header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.92);backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}
    .header-in{max-width:1280px;margin:0 auto;padding:13px 28px;display:flex;justify-content:space-between;align-items:center}
    .brand{font-weight:800;font-size:1.15rem;letter-spacing:-.03em;color:var(--txt);text-decoration:none}
    .nav{display:flex;gap:20px}
    .nav a{color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:500;transition:color .15s}
    .nav a:hover{color:var(--txt)}

    /* 상단 카테고리/도구 바 */
    .topbar{background:#fff;border-bottom:1px solid var(--line2);overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
    .topbar::-webkit-scrollbar{display:none}
    .topbar-in{max-width:1280px;margin:0 auto;padding:0 20px;display:flex;align-items:stretch;white-space:nowrap;gap:0}
    .topbar-group{display:flex;align-items:center;gap:0}
    .topbar-label{font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px;white-space:nowrap}
    .topbar-group a{display:inline-flex;align-items:center;gap:4px;padding:9px 12px;font-size:.8rem;color:var(--muted);text-decoration:none;font-weight:500;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap}
    .topbar-group a:hover{color:var(--accent);border-bottom-color:var(--accent)}
    .topbar-group a.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:700}
    .topbar-div{width:1px;background:var(--line2);margin:8px 4px;align-self:stretch}

    /* 레이아웃 */
    .page{max-width:960px;margin:0 auto;padding:36px 20px 80px}
    .page-title{font-size:clamp(1.5rem,3vw,2rem);font-weight:800;letter-spacing:-.04em;margin-bottom:6px}
    .page-desc{font-size:.9rem;color:var(--muted);margin-bottom:28px}

    /* 탭 */
    .tab-wrap{display:flex;gap:0;background:var(--bg2);border-radius:var(--radius);padding:4px;margin-bottom:24px;width:fit-content}
    .tab{padding:7px 20px;font-size:.85rem;font-weight:600;color:var(--muted);border:none;background:none;border-radius:10px;cursor:pointer;transition:all .2s}
    .tab.active{background:#fff;color:var(--txt);box-shadow:0 1px 4px rgba(0,0,0,.12)}

    /* 카드 */
    .card{background:#fff;border:1px solid var(--line2);border-radius:var(--radius);padding:24px 28px;margin-bottom:20px}
    .card-title{font-size:.88rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px}

    /* 입력 그리드 */
    .input-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .field{display:flex;flex-direction:column;gap:6px}
    .field label{font-size:.8rem;font-weight:600;color:var(--muted)}
    .field-wrap{display:flex;align-items:center;background:var(--bg2);border-radius:10px;border:1.5px solid transparent;transition:border-color .15s;overflow:hidden}
    .field-wrap:focus-within{border-color:var(--accent);background:#fff}
    .field input{flex:1;border:none;background:none;padding:10px 12px;font-size:1rem;font-weight:600;color:var(--txt);outline:none;font-family:inherit;width:0}
    .field-unit{padding:0 12px 0 4px;font-size:.82rem;font-weight:600;color:var(--muted);white-space:nowrap}

    /* 버튼 */
    .calc-btn{width:100%;margin-top:20px;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius);font-size:1rem;font-weight:700;cursor:pointer;transition:opacity .15s;font-family:inherit}
    .calc-btn:hover{opacity:.88}
    .calc-btn:active{opacity:.76}

    /* 결과 */
    .result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:4px}
    .result-item{background:var(--bg2);border-radius:var(--radius);padding:16px 18px}
    .result-label{font-size:.75rem;color:var(--muted);font-weight:600;margin-bottom:6px}
    .result-value{font-size:1.4rem;font-weight:800;letter-spacing:-.03em}
    .result-value.main{color:var(--accent);font-size:1.7rem}
    .result-value.profit{color:var(--green)}

    /* 차트 바 */
    .chart-wrap{margin-top:20px}
    .chart-title{font-size:.8rem;font-weight:700;color:var(--muted);margin-bottom:12px}
    .bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:.8rem}
    .bar-label{width:36px;text-align:right;color:var(--muted);font-weight:600;flex-shrink:0}
    .bar-track{flex:1;background:var(--bg2);border-radius:4px;height:20px;overflow:hidden;position:relative}
    .bar-fill-principal{height:100%;background:#d1d1d6;border-radius:4px 0 0 4px;position:absolute;left:0;top:0;transition:width .5s ease}
    .bar-fill-interest{height:100%;background:var(--accent);border-radius:0 4px 4px 0;position:absolute;top:0;transition:width .5s ease,left .5s ease}
    .bar-val{width:80px;text-align:right;font-weight:700;color:var(--txt);flex-shrink:0;font-size:.78rem}

    /* 적립식 추가 필드 */
    .monthly-field{display:none}
    .monthly-field.show{display:block}

    /* 안내 */
    .info-box{background:rgba(0,113,227,.05);border-left:3px solid var(--accent);border-radius:0 10px 10px 0;padding:.9rem 1.1rem;font-size:.85rem;color:#444;line-height:1.7;margin-top:20px}

    footer{text-align:center;padding:24px 20px;margin-top:20px;border-top:1px solid var(--line2);background:#fff;font-size:.8rem;color:var(--muted)}
    footer a{color:inherit;text-decoration:none;margin:0 10px}
    .footer-copy{margin-top:8px;font-size:.75rem}

    @media(max-width:640px){
      .input-grid{grid-template-columns:1fr 1fr}
      .result-grid{grid-template-columns:1fr 1fr}
      .result-value.main{font-size:1.4rem}
      .card{padding:18px 16px}
      .page{padding:20px 14px 60px}
    }
  </style>
</head>
<body>

<header class="header">
  <div class="header-in">
    <a href="index.html" class="brand">비숑 웰니스</a>
    <nav class="nav">
      <a href="index.html">홈</a>
      <a href="about.html">소개</a>
      <a href="reservation.html">예약</a>
    </nav>
  </div>
</header>

<div class="topbar">
  <div class="topbar-in">
    <div class="topbar-group">
      <span class="topbar-label">카테고리</span>
      <a href="index.html">전체</a>
      <a href="index.html">건강정보</a>
      <a href="index.html">운동</a>
      <a href="index.html">식단</a>
      <a href="index.html">영양제</a>
      <a href="index.html">다이어트</a>
    </div>
    <div class="topbar-div"></div>
    <div class="topbar-group">
      <span class="topbar-label">도구</span>
      <a href="compound-calculator.html" class="active">💰 복리계산기</a>
      <a href="lotto.html">🎱 로또번호</a>
      <a href="code-playground.html">💻 코드연습창</a>
    </div>
  </div>
</div>

<div class="page">
  <h1 class="page-title">💰 복리계산기</h1>
  <p class="page-desc">원금, 연이율, 기간을 입력하면 복리로 불어나는 미래 자산을 계산합니다.</p>

  <!-- 일복리/거치식/적립식 탭 -->
  <div class="tab-wrap">
    <button class="tab" id="tabDaily" onclick="switchMode('daily',this)" style="color:#30d158">📅 일복리</button>
    <button class="tab active" onclick="switchMode('lump',this)">거치식 (일시 투자)</button>
    <button class="tab" onclick="switchMode('monthly',this)">적립식 (매월 투자)</button>
  </div>

  <!-- 입력 카드 -->
  <div class="card">
    <div class="card-title">투자 조건 입력</div>
    <div class="input-grid">
      <div class="field">
        <label>초기 원금</label>
        <div class="field-wrap">
          <input type="number" id="principal" value="10000000" min="0">
          <span class="field-unit">원</span>
        </div>
      </div>
      <div class="field monthly-field" id="monthlyField">
        <label>매월 추가 납입</label>
        <div class="field-wrap">
          <input type="number" id="monthly" value="300000" min="0">
          <span class="field-unit">원</span>
        </div>
      </div>
      <div class="field">
        <label>연 이율 (수익률)</label>
        <div class="field-wrap">
          <input type="number" id="rate" value="7" step="0.1" min="0" max="100">
          <span class="field-unit">%</span>
        </div>
      </div>
      <div class="field">
        <label>투자 기간</label>
        <div class="field-wrap">
          <input type="number" id="years" value="20" min="1" max="50">
          <span class="field-unit">년</span>
        </div>
      </div>
      <div class="field">
        <label>복리 주기</label>
        <div class="field-wrap" style="background:var(--bg2)">
          <select id="compound" style="flex:1;border:none;background:none;padding:10px 12px;font-size:.95rem;font-weight:600;color:var(--txt);outline:none;font-family:inherit">
            <option value="365">일 복리</option>
            <option value="12">월 복리</option>
            <option value="4">분기 복리</option>
            <option value="1" selected>연 복리</option>
          </select>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="calc-btn" style="margin-top:0" onclick="calculate()">계산하기</button>
      <button class="calc-btn" style="margin-top:0;background:#30d158;flex:0 0 auto;width:auto;padding:14px 20px" onclick="calcDaily()">📅 일복리 상세보기</button>
    </div>
  </div>

  <!-- 결과 카드 -->
  <div class="card" id="resultCard" style="display:none">
    <div class="card-title">계산 결과</div>
    <div class="result-grid">
      <div class="result-item">
        <div class="result-label">미래 자산 (원리합계)</div>
        <div class="result-value main" id="rTotal">—</div>
      </div>
      <div class="result-item">
        <div class="result-label">총 납입 원금</div>
        <div class="result-value" id="rPrincipal">—</div>
      </div>
      <div class="result-item">
        <div class="result-label">총 이자·수익</div>
        <div class="result-value profit" id="rInterest">—</div>
      </div>
    </div>

    <!-- 연도별 막대 차트 -->
    <div class="chart-wrap">
      <div class="chart-title">연도별 자산 추이 <span style="font-weight:400;color:#aaa">(■ 원금 &nbsp;■ 수익)</span></div>
      <div id="chartBars"></div>
    </div>

    <div class="info-box">
      💡 <strong>72의 법칙:</strong> 원금이 2배가 되는 기간 ≈ 72 ÷ 연이율<br>
      현재 이율 <strong id="ruleRate">—</strong>% 기준으로 약 <strong id="ruleYears">—</strong>년 후 원금이 2배가 됩니다.
    </div>
  </div>

  <!-- 일복리 상세 카드 (인라인) -->
  <div id="dailyCard" class="card" style="display:none;border-color:#30d158;border-width:1.5px;padding:20px 20px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div>
        <div class="card-title" style="color:#30d158;margin-bottom:3px">📅 일복리 (365회/년) 날짜별 자동계산</div>
        <div id="dailySubtitle" style="font-size:.8rem;color:#86868b"></div>
      </div>
      <button onclick="document.getElementById('dailyCard').style.display='none'" style="background:#f5f5f7;border:none;border-radius:50%;width:30px;height:30px;font-size:1rem;cursor:pointer;flex-shrink:0">✕</button>
    </div>

    <!-- 요약 -->
    <div id="dailySummary" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px"></div>

    <!-- 비교 배너 -->
    <div id="dailyCompare" style="padding:10px 14px;background:rgba(48,209,88,.08);border-left:3px solid #30d158;border-radius:0 8px 8px 0;font-size:.83rem;color:#1d1d1f;line-height:1.7;margin-bottom:14px"></div>

    <!-- 테이블 툴바 -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:8px">
      <div id="dailyTableLabel" style="font-size:.75rem;font-weight:700;color:#86868b;text-transform:uppercase;letter-spacing:.05em"></div>
      <div style="display:flex;gap:6px">
        <button id="btn365" onclick="setDailyRows(365)" style="padding:5px 14px;font-size:.78rem;font-weight:700;border-radius:8px;border:1.5px solid #30d158;background:#30d158;color:#fff;cursor:pointer">365일</button>
        <button id="btn1000" onclick="setDailyRows(1000)" style="padding:5px 14px;font-size:.78rem;font-weight:700;border-radius:8px;border:1.5px solid #e8e8eb;background:#fff;color:#86868b;cursor:pointer">1000일</button>
      </div>
    </div>

    <!-- 엑셀형 테이블 -->
    <div style="overflow:auto;max-height:520px;border:1px solid #e8e8eb;border-radius:10px">
      <table id="dailyTable" style="width:100%;border-collapse:collapse;font-size:.82rem;min-width:560px">
        <thead id="dailyThead"></thead>
        <tbody id="dailyTbody"></tbody>
      </table>
    </div>
    <div style="font-size:.75rem;color:#aaa;margin-top:8px;text-align:right" id="dailyRowCount"></div>
  </div>
</div>

<footer>
  <a href="privacy.html">개인정보 처리방침</a> |
  <a href="terms.html">이용약관</a> |
  <a href="contact.html">문의하기</a>
  <div class="footer-copy">© 2026 비숑 웰니스. All rights reserved.</div>
</footer>

<script>
  let mode = 'lump';

  function switchMode(m, btn) {
    mode = m === 'daily' ? 'lump' : m;
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.style.color = t.id === 'tabDaily' ? '#30d158' : '';
    });
    btn.classList.add('active');
    btn.style.color = m === 'daily' ? '#30d158' : '';
    const mf = document.getElementById('monthlyField');
    if (m === 'monthly') mf.classList.add('show');
    else mf.classList.remove('show');
    if (m === 'daily') {
      document.getElementById('compound').value = '365';
      calculate();
      calcDaily();
    }
  }

  function fmt(n) {
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '억원';
    if (n >= 1e4) return Math.round(n / 1e4) + '만원';
    return Math.round(n).toLocaleString() + '원';
  }

  function calculate() {
    const P  = parseFloat(document.getElementById('principal').value) || 0;
    const M  = parseFloat(document.getElementById('monthly').value)   || 0;
    const r  = parseFloat(document.getElementById('rate').value)      / 100;
    const n  = parseInt(document.getElementById('compound').value);
    const Y  = parseInt(document.getElementById('years').value)       || 1;

    // 연도별 계산
    const yearly = [];
    for (let y = 1; y <= Y; y++) {
      let fv;
      if (mode === 'lump') {
        fv = P * Math.pow(1 + r / n, n * y);
      } else {
        // 거치분 + 적립분 (월 납입)
        const fvLump = P * Math.pow(1 + r / n, n * y);
        const rM = r / 12;
        const fvMonthly = M * ((Math.pow(1 + rM, 12 * y) - 1) / rM) * (1 + rM);
        fv = fvLump + fvMonthly;
      }
      const totalPaid = mode === 'lump' ? P : P + M * 12 * y;
      yearly.push({ y, fv, principal: totalPaid, interest: fv - totalPaid });
    }

    const last = yearly[yearly.length - 1];
    document.getElementById('rTotal').textContent    = fmt(last.fv);
    document.getElementById('rPrincipal').textContent = fmt(last.principal);
    document.getElementById('rInterest').textContent  = fmt(last.interest);
    document.getElementById('ruleRate').textContent   = (r * 100).toFixed(1);
    document.getElementById('ruleYears').textContent  = r > 0 ? (72 / (r * 100)).toFixed(1) : '∞';

    // 차트
    const bars = document.getElementById('chartBars');
    bars.innerHTML = '';
    const step = Math.max(1, Math.floor(Y / 10));
    const maxFv = last.fv;
    const shown = yearly.filter((_, i) => (i + 1) % step === 0 || i === Y - 1);
    shown.forEach(({ y, fv, principal }) => {
      const pct  = (principal / maxFv * 100).toFixed(1);
      const iPct = ((fv - principal) / maxFv * 100).toFixed(1);
      bars.innerHTML += \`
        <div class="bar-row">
          <span class="bar-label">\${y}년</span>
          <div class="bar-track">
            <div class="bar-fill-principal" style="width:\${pct}%"></div>
            <div class="bar-fill-interest" style="left:\${pct}%;width:\${iPct}%"></div>
          </div>
          <span class="bar-val">\${fmt(fv)}</span>
        </div>\`;
    });

    document.getElementById('resultCard').style.display = 'block';
    document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // 일복리 계산 상태 저장
  let _dailyState = null;

  function calcDaily() {
    const P = parseFloat(document.getElementById('principal').value) || 0;
    const M = parseFloat(document.getElementById('monthly').value)   || 0;
    const r = parseFloat(document.getElementById('rate').value)      / 100;
    const Y = parseInt(document.getElementById('years').value)       || 1;
    const nCur = parseInt(document.getElementById('compound').value);
    const dailyRate = r / 365;
    const startDate = new Date();

    function fvDaily(d) {
      const bal = P * Math.pow(1 + dailyRate, d);
      if (mode !== 'monthly') return bal;
      const rM = r / 12;
      const months = Math.floor(d / 30.4375);
      return bal + (months > 0 && rM > 0 ? M * ((Math.pow(1 + rM, months) - 1) / rM) * (1 + rM) : 0);
    }

    function fvCurrent(days) {
      const n = nCur;
      const yrs = days / 365;
      if (mode !== 'monthly') return P * Math.pow(1 + r / n, n * yrs);
      const fvL = P * Math.pow(1 + r / n, n * yrs);
      const rM = r / 12;
      const months = Math.floor(days / 30.4375);
      return fvL + (rM > 0 && months > 0 ? M * ((Math.pow(1 + rM, months) - 1) / rM) * (1 + rM) : 0);
    }

    const totalPaid365 = mode === 'lump' ? P : P + M * 12 * Math.min(Y, 1);
    const final365 = fvDaily(365);
    const finalCur365 = fvCurrent(365);
    const diff = final365 - finalCur365;
    const nLabel = {365:'일복리',12:'월복리',4:'분기복리',1:'연복리'}[nCur] || '연복리';

    document.getElementById('dailySubtitle').textContent =
      \`원금 \${fmt(P)} · 연 \${(r*100).toFixed(1)}% · 일 복리 (\${mode==='monthly'?'적립식':'거치식'})\`;

    document.getElementById('dailySummary').innerHTML = \`
      <div style="background:#f5f5f7;border-radius:10px;padding:12px 14px">
        <div style="font-size:.7rem;color:#86868b;font-weight:600;margin-bottom:4px">365일 후 자산</div>
        <div style="font-size:1.25rem;font-weight:800;color:#0071e3;letter-spacing:-.03em">\${fmt(final365)}</div>
      </div>
      <div style="background:#f5f5f7;border-radius:10px;padding:12px 14px">
        <div style="font-size:.7rem;color:#86868b;font-weight:600;margin-bottom:4px">납입 원금</div>
        <div style="font-size:1.25rem;font-weight:800;letter-spacing:-.03em">\${fmt(P)}</div>
      </div>
      <div style="background:#f5f5f7;border-radius:10px;padding:12px 14px">
        <div style="font-size:.7rem;color:#86868b;font-weight:600;margin-bottom:4px">1년 수익</div>
        <div style="font-size:1.25rem;font-weight:800;color:#30d158;letter-spacing:-.03em">\${fmt(final365 - P)}</div>
      </div>\`;

    const sign = diff >= 0 ? '+' : '';
    document.getElementById('dailyCompare').innerHTML =
      \`📊 <strong>\${nLabel}</strong> 대비 일복리 365일 시 <strong style="color:\${diff>=0?'#30d158':'#ff453a'}">\${sign}\${fmt(Math.abs(diff))}</strong> \${diff>=0?'▲더 많음':'▼더 적음'} &nbsp;|&nbsp; 일 이자율 <strong>\${(dailyRate*100).toFixed(6)}%</strong>\`;

    // 상태 저장 후 테이블 렌더
    _dailyState = { P, r, Y, M, dailyRate, startDate, fvDaily };
    renderDailyTable(365);

    const dc = document.getElementById('dailyCard');
    dc.style.display = 'block';
    dc.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setDailyRows(n) {
    if (!_dailyState) return;
    document.getElementById('btn365').style.cssText  = n===365
      ? 'padding:5px 14px;font-size:.78rem;font-weight:700;border-radius:8px;border:1.5px solid #30d158;background:#30d158;color:#fff;cursor:pointer'
      : 'padding:5px 14px;font-size:.78rem;font-weight:700;border-radius:8px;border:1.5px solid #e8e8eb;background:#fff;color:#86868b;cursor:pointer';
    document.getElementById('btn1000').style.cssText = n===1000
      ? 'padding:5px 14px;font-size:.78rem;font-weight:700;border-radius:8px;border:1.5px solid #30d158;background:#30d158;color:#fff;cursor:pointer'
      : 'padding:5px 14px;font-size:.78rem;font-weight:700;border-radius:8px;border:1.5px solid #e8e8eb;background:#fff;color:#86868b;cursor:pointer';
    renderDailyTable(n);
  }

  function renderDailyTable(maxDays) {
    const { P, r, dailyRate, startDate, fvDaily } = _dailyState;

    document.getElementById('dailyTableLabel').textContent = \`날짜별 잔액 추이\`;
    document.getElementById('dailyRowCount').textContent = \`총 \${maxDays}행 표시 중\`;

    // 헤더 스타일
    const thBase = 'position:sticky;top:0;background:#1d1d1f;color:#fff;font-size:.75rem;font-weight:700;padding:9px 12px;white-space:nowrap;z-index:2;border-right:1px solid #333';
    const thR    = thBase + ';text-align:right';
    const thL    = thBase + ';text-align:left';

    document.getElementById('dailyThead').innerHTML = \`<tr>
      <th style="\${thL};min-width:46px">No.</th>
      <th style="\${thL};min-width:90px">날짜</th>
      <th style="\${thR};min-width:110px">잔액</th>
      <th style="\${thR};min-width:100px">당일 이자</th>
      <th style="\${thR};min-width:110px">누적 수익</th>
      <th style="\${thR};min-width:72px">수익률</th>
    </tr>\`;

    // 행 스타일
    const tdBase = 'padding:6px 12px;border-bottom:1px solid #f0f0f2;white-space:nowrap;font-size:.81rem';
    const tdR    = tdBase + ';text-align:right';
    const tdL    = tdBase + ';text-align:left';

    const today = new Date(startDate);
    let rows = '';
    let prev = P;

    for (let d = 1; d <= maxDays; d++) {
      const bal     = fvDaily(d);
      const dayInt  = bal - prev;
      const cum     = bal - P;
      const pct     = ((bal / P - 1) * 100).toFixed(4);

      // 날짜 계산
      const dt = new Date(today);
      dt.setDate(dt.getDate() + d);
      const dateStr = \`\${dt.getFullYear()}.\${String(dt.getMonth()+1).padStart(2,'0')}.\${String(dt.getDate()).padStart(2,'0')}\`;

      // 하이라이트: 7일마다 연하게, 30일마다 진하게, 365일마다 파랗게
      const is365 = d % 365 === 0;
      const is30  = !is365 && d % 30 === 0;
      const is7   = !is365 && !is30 && d % 7 === 0;
      const bg = is365 ? '#e8f0fe' : is30 ? '#f0fff4' : is7 ? '#fafafa' : '#fff';
      const fw = is365 || is30 ? '700' : '400';

      rows += \`<tr style="background:\${bg}">
        <td style="\${tdL};color:#aaa;font-size:.73rem">\${d}</td>
        <td style="\${tdL};color:#555;font-size:.78rem">\${dateStr}</td>
        <td style="\${tdR};font-weight:\${fw};color:\${is365?'#0071e3':'#1d1d1f'}">\${fmtEx(bal)}</td>
        <td style="\${tdR};color:#30d158">+\${fmtEx(dayInt)}</td>
        <td style="\${tdR};color:#0071e3">\${fmtEx(cum)}</td>
        <td style="\${tdR};color:\${parseFloat(pct)>0?'#30d158':'#ff453a'}">\${pct}%</td>
      </tr>\`;
      prev = bal;
    }
    document.getElementById('dailyTbody').innerHTML = rows;
  }

  // 엑셀용 상세 포맷 (원 단위까지)
  function fmtEx(n) {
    return Math.round(n).toLocaleString('ko-KR') + '원';
  }

  // 초기 자동 계산
  calculate();
</script>
</body>
</html>
`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (request.method === "GET" && path === "/lotto-gen") {
        return new Response(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="google-adsense-account" content="ca-pub-3425189666333844">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>로또 번호 생성기 | 비숑버프</title>
  <meta name="description" content="무료 로또 6/45 번호 자동 생성기. 행운의 번호 5세트를 즉시 뽑아보세요.">
  <link rel="canonical" href="https://bichonbuff.com/lotto-gen">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',system-ui,sans-serif;background:#0f0f11;color:#f0eff5;min-height:100vh;-webkit-font-smoothing:antialiased}

    /* 헤더 */
    .header{position:sticky;top:0;z-index:50;background:rgba(15,15,17,.85);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07);padding:12px 20px;display:flex;align-items:center;gap:16px}
    .home-btn{display:inline-flex;align-items:center;gap:6px;color:#c8b8ff;text-decoration:none;font-size:.84rem;font-weight:600;padding:6px 14px;border:1px solid rgba(200,184,255,.25);border-radius:999px;background:rgba(200,184,255,.08);transition:all .15s}
    .home-btn:hover{background:rgba(200,184,255,.18);border-color:rgba(200,184,255,.5)}
    .header-title{font-size:.95rem;font-weight:700;color:#f0eff5;letter-spacing:-.02em}

    /* 본문 */
    .page{max-width:700px;margin:0 auto;padding:40px 20px 60px}
    .hero{text-align:center;margin-bottom:36px}
    .badge{display:inline-block;font-size:.72rem;font-weight:700;letter-spacing:.12em;color:#c8b8ff;background:rgba(200,184,255,.12);border:1px solid rgba(200,184,255,.25);border-radius:999px;padding:5px 14px;margin-bottom:14px;text-transform:uppercase}
    h1{font-size:clamp(1.8rem,5vw,2.6rem);font-weight:800;letter-spacing:-.04em;line-height:1.15;margin-bottom:10px}
    h1 span{color:#c8b8ff}
    .subtitle{font-size:.92rem;color:#888796;line-height:1.6}

    /* 세트 목록 */
    .sets{display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
    .set-row{background:#1a1a1f;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:14px;transition:border-color .2s;animation:fadeUp .4s ease both}
    .set-row:hover{border-color:rgba(200,184,255,.25)}
    @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .set-num{font-size:.75rem;font-weight:700;color:#555;min-width:28px;font-variant-numeric:tabular-nums}
    .balls{display:flex;gap:8px;flex:1;flex-wrap:wrap}
    .ball{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.88rem;font-weight:700;flex-shrink:0;transition:transform .3s}
    .ball:hover{transform:scale(1.1)}
    .b1{background:#FFD54F;color:#3d2e00}
    .b2{background:#64B5F6;color:#003366}
    .b3{background:#81C784;color:#1b3d1c}
    .b4{background:#FF8A65;color:#5c1a00}
    .b5{background:#CE93D8;color:#3d0050}
    .bonus-sep{color:#555;font-size:1rem;font-weight:300}
    .bonus{border:2px solid rgba(200,184,255,.5)!important;background:transparent!important;color:#c8b8ff!important}
    .tag{font-size:.7rem;padding:3px 9px;border-radius:999px;font-weight:600;white-space:nowrap}
    .tag-hot{background:rgba(255,138,101,.15);color:#FF8A65;border:1px solid rgba(255,138,101,.3)}
    .tag-bal{background:rgba(129,199,132,.12);color:#81C784;border:1px solid rgba(129,199,132,.3)}
    .tag-num{background:rgba(200,184,255,.1);color:#c8b8ff;border:1px solid rgba(200,184,255,.25)}

    /* 번호판 */
    .number-grid{margin-bottom:28px}
    .grid-title{font-size:.72rem;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
    .grid{display:grid;grid-template-columns:repeat(9,1fr);gap:6px}
    .num-cell{aspect-ratio:1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .2s;border:1px solid rgba(255,255,255,.06);background:#1a1a1f;color:#555;user-select:none}
    .num-cell.sel{color:#000;transform:scale(1.05)}
    .num-cell.b1{background:#FFD54F;border-color:#FFD54F;color:#3d2e00}
    .num-cell.b2{background:#64B5F6;border-color:#64B5F6;color:#003366}
    .num-cell.b3{background:#81C784;border-color:#81C784;color:#1b3d1c}
    .num-cell.b4{background:#FF8A65;border-color:#FF8A65;color:#5c1a00}
    .num-cell.b5{background:#CE93D8;border-color:#CE93D8;color:#3d0050}

    /* 버튼 */
    .btn-wrap{display:flex;gap:10px;justify-content:center;margin-bottom:28px;flex-wrap:wrap}
    .gen-btn{padding:14px 36px;font-size:1rem;font-family:inherit;font-weight:700;cursor:pointer;background:rgba(200,184,255,.1);border:1px solid rgba(200,184,255,.35);border-radius:14px;color:#c8b8ff;letter-spacing:.01em;transition:all .2s;min-width:160px}
    .gen-btn:hover{background:rgba(200,184,255,.2);border-color:rgba(200,184,255,.6);transform:translateY(-1px)}
    .gen-btn:active{transform:scale(.98)}
    .gen-btn.primary{background:linear-gradient(135deg,#8b5cf6,#c8b8ff);color:#1a1a1f;border-color:transparent}
    .gen-btn.primary:hover{opacity:.9}

    /* 통계 */
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:28px}
    .stat-card{background:#1a1a1f;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px;text-align:center}
    .stat-val{font-size:1.4rem;font-weight:800;color:#c8b8ff;letter-spacing:-.02em}
    .stat-lbl{font-size:.7rem;color:#555;margin-top:4px}

    /* 꿈 해몽 */
    .dream-section{background:#1a1a1f;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:20px;margin-bottom:20px}
    .dream-title{font-size:.85rem;font-weight:700;margin-bottom:12px;color:#c8b8ff}
    .dream-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
    .dream-item{background:#222228;border-radius:8px;padding:8px 12px;font-size:.78rem;color:#888796;cursor:pointer;transition:background .15s;border:1px solid transparent}
    .dream-item:hover{background:#2a2a30;border-color:rgba(200,184,255,.2)}
    .dream-item strong{color:#f0eff5;display:block;margin-bottom:2px}

    footer{text-align:center;padding:24px;font-size:.75rem;color:#555;border-top:1px solid rgba(255,255,255,.07)}
    @media(max-width:480px){.balls{gap:5px}.ball{width:36px;height:36px;font-size:.78rem}.grid{grid-template-columns:repeat(9,1fr)}}
  </style>
</head>
<body>

<header class="header">
  <a href="/" class="home-btn">← 홈으로</a>
  <span class="header-title">🎱 로또 번호 생성기</span>
</header>

<div class="page">
  <div class="hero">
    <div class="badge">Lotto 6/45</div>
    <h1>행운의 <span>로또 번호</span><br>지금 뽑아보세요</h1>
    <p class="subtitle">매주 토요일 추첨 · 1~45에서 6개 선택</p>
  </div>

  <!-- 통계 -->
  <div class="stats">
    <div class="stat-card"><div class="stat-val" id="statTotal">0</div><div class="stat-lbl">총 생성 횟수</div></div>
    <div class="stat-card"><div class="stat-val" id="statHot">–</div><div class="stat-lbl">오늘 최다 번호</div></div>
    <div class="stat-card"><div class="stat-val">1/8,145,060</div><div class="stat-lbl">당첨 확률</div></div>
  </div>

  <!-- 번호 세트 -->
  <div class="sets" id="sets">
    <div style="text-align:center;padding:40px;color:#555;font-size:.9rem">아래 버튼을 눌러 번호를 생성하세요 🎲</div>
  </div>

  <!-- 버튼 -->
  <div class="btn-wrap">
    <button class="gen-btn primary" onclick="generate()">🎲 번호 생성 (5세트)</button>
    <button class="gen-btn" onclick="generateOne()">+ 1세트 추가</button>
    <button class="gen-btn" onclick="reset()" style="color:#ff453a;border-color:rgba(255,69,58,.3)">초기화</button>
  </div>

  <!-- 번호판 -->
  <div class="number-grid">
    <div class="grid-title">번호 분포판 (클릭으로 즐겨찾기)</div>
    <div class="grid" id="numGrid"></div>
  </div>

  <!-- 꿈 해몽 -->
  <div class="dream-section">
    <div class="dream-title">💭 꿈 해몽 번호 뽑기</div>
    <div class="dream-grid">
      <div class="dream-item" onclick="dreamPick('뱀')"><strong>🐍 뱀 꿈</strong>재물운 상승</div>
      <div class="dream-item" onclick="dreamPick('돼지')"><strong>🐷 돼지 꿈</strong>복권 행운</div>
      <div class="dream-item" onclick="dreamPick('불')"><strong>🔥 불 꿈</strong>강한 에너지</div>
      <div class="dream-item" onclick="dreamPick('물')"><strong>🌊 물 꿈</strong>새로운 시작</div>
      <div class="dream-item" onclick="dreamPick('호랑이')"><strong>🐯 호랑이 꿈</strong>권위와 성공</div>
      <div class="dream-item" onclick="dreamPick('하늘')"><strong>☁️ 하늘 꿈</strong>높은 목표</div>
    </div>
  </div>
</div>

<footer>© 2026 비숑버프 · <a href="/" style="color:#c8b8ff;text-decoration:none">홈으로</a></footer>

<script>
  const BALL_CLASS = ['b1','b2','b3','b4','b5'];
  function ballClass(n){
    if(n<=10) return 'b1';
    if(n<=20) return 'b2';
    if(n<=30) return 'b3';
    if(n<=40) return 'b4';
    return 'b5';
  }
  function pick6(){
    const pool=[...Array(45)].map((_,i)=>i+1);
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    return pool.slice(0,6).sort((a,b)=>a-b);
  }

  let allSets=[];
  let genCount=0;
  const freqMap={};

  function ballHtml(n,extra=''){
    return \`<div class="ball \${ballClass(n)}\${extra}">\${n}</div>\`;
  }

  function tagHtml(nums){
    const sum=nums.reduce((a,b)=>a+b,0);
    const avg=sum/6;
    if(avg>28) return '<span class="tag tag-hot">고번호</span>';
    if(avg<18) return '<span class="tag tag-num">저번호</span>';
    return '<span class="tag tag-bal">균형</span>';
  }

  function renderSets(){
    const cont=document.getElementById('sets');
    if(!allSets.length){cont.innerHTML='<div style="text-align:center;padding:40px;color:#555;font-size:.9rem">아래 버튼을 눌러 번호를 생성하세요 🎲</div>';return;}
    cont.innerHTML=allSets.map((nums,i)=>\`
      <div class="set-row" style="animation-delay:\${i*0.06}s">
        <span class="set-num">\${i+1}세트</span>
        <div class="balls">\${nums.map(n=>ballHtml(n)).join('')}</div>
        \${tagHtml(nums)}
      </div>\`).join('');
  }

  function updateGrid(){
    const grid=document.getElementById('numGrid');
    const freq={};
    allSets.forEach(s=>s.forEach(n=>{freq[n]=(freq[n]||0)+1;}));
    grid.innerHTML=[...Array(45)].map((_,i)=>{
      const n=i+1;
      const sel=freq[n]?\` sel \${ballClass(n)}\`:'';
      return \`<div class="num-cell\${sel}" title="\${n}">\${n}</div>\`;
    }).join('');
  }

  function updateStats(){
    const freq={};
    allSets.forEach(s=>s.forEach(n=>{freq[n]=(freq[n]||0)+1;}));
    const top=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0];
    document.getElementById('statTotal').textContent=genCount;
    document.getElementById('statHot').textContent=top?top[0]:'–';
  }

  function generate(){
    allSets=[];
    for(let i=0;i<5;i++) allSets.push(pick6());
    genCount+=5;
    renderSets(); updateGrid(); updateStats();
  }

  function generateOne(){
    if(allSets.length>=10) allSets.shift();
    allSets.push(pick6());
    genCount+=1;
    renderSets(); updateGrid(); updateStats();
  }

  function reset(){
    allSets=[];
    renderSets(); updateGrid(); updateStats();
  }

  function dreamPick(theme){
    // 테마별 시드 기반 번호 생성
    const seeds={'뱀':[3,13,23,33,43,8],'돼지':[7,14,21,28,35,42],'불':[5,15,25,35,45,10],'물':[2,11,22,31,40,6],'호랑이':[4,12,24,36,44,9],'하늘':[1,9,18,27,36,45]};
    const base=seeds[theme]||[1,7,14,21,28,35];
    const nums=base.map(n=>{const offset=Math.floor(Math.random()*5)-2;return Math.min(45,Math.max(1,n+offset));});
    const unique=[...new Set(nums)];
    while(unique.length<6) unique.push(Math.floor(Math.random()*45)+1);
    const final=[...new Set(unique)].slice(0,6).sort((a,b)=>a-b);
    allSets=[final,...allSets.slice(0,4)];
    genCount+=1;
    renderSets(); updateGrid(); updateStats();
    alert(\`\${theme} 꿈 기반 번호: \${final.join(' - ')}\`);
  }

  // 초기 렌더
  updateGrid();
</script>
</body>
</html>
`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (request.method === "GET" && path === "/code") {
        return new Response(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="google-adsense-account" content="ca-pub-3425189666333844">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>코드연습창 — HTML/CSS/JS 배우기 | 비숑버프</title>
  <meta name="description" content="브라우저에서 HTML, CSS, JavaScript를 배우고 바로 실습해보세요. 강의 + 에디터 + 실시간 미리보기.">
  <link rel="canonical" href="https://bichonbuff.com/code">
  <style>
    :root{--bg:#fff;--bg2:#f5f5f7;--line:#d2d2d7;--line2:#e8e8eb;--muted:#86868b;--txt:#1d1d1f;--accent:#0071e3;--dark:#1c1c1e;--dark2:#2c2c2e;--dark3:#3a3a3c;--green:#30d158;--orange:#ff9f0a;--red:#ff453a}
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',system-ui,sans-serif;background:#f8f8fa;color:var(--txt);-webkit-font-smoothing:antialiased;display:flex;flex-direction:column;height:100vh;overflow:hidden}

    /* 헤더 */
    .header{background:rgba(255,255,255,.92);backdrop-filter:blur(20px);border-bottom:.5px solid rgba(0,0,0,.08);flex-shrink:0}
    .header-in{padding:10px 20px;display:flex;justify-content:space-between;align-items:center}
    .brand{font-weight:800;font-size:1.05rem;letter-spacing:-.03em;color:var(--txt);text-decoration:none}
    .nav a{color:var(--muted);text-decoration:none;font-size:.82rem;font-weight:500;margin-left:16px}
    .nav a:hover{color:var(--txt)}

    /* 모드 탭바 */
    .modebar{background:#fff;border-bottom:1px solid var(--line2);display:flex;align-items:center;padding:0 16px;gap:4px;flex-shrink:0}
    .mode-tab{padding:10px 16px;font-size:.84rem;font-weight:600;color:var(--muted);border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-family:inherit}
    .mode-tab:hover{color:var(--txt)}
    .mode-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
    .mode-sep{width:1px;height:20px;background:var(--line2);margin:0 8px}

    /* 에디터 툴바 */
    .editor-toolbar{background:var(--dark);display:flex;align-items:center;gap:8px;padding:7px 14px;flex-shrink:0}
    .toolbar-title{font-size:.85rem;font-weight:700;color:#ebebf5;flex:1}
    .run-btn{background:var(--green);color:#000;border:none;padding:6px 14px;border-radius:7px;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit}
    .run-btn:hover{opacity:.85}
    .clear-btn{background:var(--dark3);color:#ebebf5;border:none;padding:6px 12px;border-radius:7px;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit}
    .clear-btn:hover{background:#48484a}
    .example-select{background:var(--dark3);color:#ebebf5;border:none;padding:6px 10px;border-radius:7px;font-size:.78rem;cursor:pointer;font-family:inherit;outline:none}

    /* 코드탭 */
    .tab-bar{background:var(--dark2);display:flex;align-items:center;flex-shrink:0;border-bottom:1px solid #3a3a3c}
    .ed-tab{padding:7px 16px;font-size:.8rem;font-weight:600;color:#8e8e93;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;font-family:inherit}
    .ed-tab:hover{color:#ebebf5}
    .ed-tab.active{color:#fff;border-bottom-color:var(--accent)}

    /* 에디터 */
    .workspace{flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden}
    .editor-pane{display:flex;flex-direction:column;background:var(--dark);overflow:hidden}
    .editor-pane.hidden{display:none}
    textarea.code{flex:1;background:#1c1c1e;color:#e8e8f0;border:none;padding:14px 16px;font-family:'Fira Code','Cascadia Code','Consolas',monospace;font-size:.88rem;line-height:1.65;resize:none;outline:none;tab-size:2}
    textarea.code::selection{background:rgba(0,113,227,.4)}
    .preview-pane{background:#fff;display:flex;flex-direction:column;border-left:2px solid var(--accent)}
    .preview-label{background:#f0f0f5;padding:5px 14px;font-size:.72rem;font-weight:700;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;border-bottom:1px solid var(--line2);flex-shrink:0}
    iframe#preview{flex:1;border:none;background:#fff}

    /* ── 강의 모드 ── */
    .learn-page{flex:1;display:none;overflow:hidden}
    .learn-page.active{display:grid;grid-template-columns:340px 1fr}

    /* 강의 내용 패널 */
    .learn-panel{background:#fff;overflow-y:auto;border-right:1px solid var(--line2);display:flex;flex-direction:column}
    .learn-nav{display:flex;background:var(--bg2);border-bottom:1px solid var(--line2);flex-shrink:0}
    .learn-nav-btn{flex:1;padding:10px 6px;font-size:.78rem;font-weight:700;color:var(--muted);border:none;background:none;cursor:pointer;border-bottom:3px solid transparent;transition:all .15s;font-family:inherit}
    .learn-nav-btn:hover{color:var(--txt)}
    .learn-nav-btn.active{color:var(--accent);border-bottom-color:var(--accent);background:#fff}
    .lesson{display:none;padding:20px;flex:1;overflow-y:auto}
    .lesson.active{display:block}
    .lesson h2{font-size:1.1rem;font-weight:800;margin-bottom:4px;letter-spacing:-.03em}
    .lesson .subtitle{font-size:.8rem;color:var(--muted);margin-bottom:20px}
    .lesson h3{font-size:.92rem;font-weight:700;margin:20px 0 8px;padding-left:10px;border-left:3px solid var(--accent)}
    .lesson p{font-size:.84rem;color:#3a3a3c;line-height:1.8;margin-bottom:10px}
    .lesson ul{font-size:.84rem;color:#3a3a3c;line-height:1.9;padding-left:20px;margin-bottom:10px}
    .code-block{background:#1c1c1e;color:#e8e8f0;padding:14px 16px;border-radius:10px;font-family:'Fira Code','Consolas',monospace;font-size:.8rem;line-height:1.7;margin:10px 0 16px;overflow-x:auto;white-space:pre}
    .keyword{color:#ff7ab2}
    .tag{color:#ff8170}
    .attr{color:#78c2b3}
    .value{color:#fc6a5d}
    .comment{color:#7f8c98}
    .prop{color:#41a1c0}
    .str{color:#fc6a5d}
    .num{color:#d9c97c}
    .fn{color:#dac5e4}
    .tip{background:#e8f4fd;border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 8px 8px 0;font-size:.82rem;color:#1d1d1f;margin:12px 0;line-height:1.7}
    .try-btn{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;margin-top:8px;font-family:inherit;transition:opacity .15s}
    .try-btn:hover{opacity:.85}
    .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.7rem;font-weight:700;margin-left:6px}
    .badge-html{background:#fff3e0;color:#e65100}
    .badge-css{background:#e3f2fd;color:#1565c0}
    .badge-js{background:#f3e5f5;color:#6a1b9a}

    /* 강의 에디터 */
    .learn-editor{display:flex;flex-direction:column;overflow:hidden}
    .learn-toolbar{background:var(--dark);display:flex;align-items:center;gap:8px;padding:7px 14px;flex-shrink:0}
    .learn-split{flex:1;display:grid;grid-template-rows:1fr 1fr;overflow:hidden}
    .mini-editor{background:var(--dark);overflow:hidden;display:flex;flex-direction:column}
    .mini-label{background:var(--dark2);padding:5px 14px;font-size:.72rem;font-weight:700;color:#8e8e93;letter-spacing:.04em;flex-shrink:0;display:flex;align-items:center;gap:8px}
    .mini-label span{color:#ebebf5}
    textarea.mini-code{flex:1;background:#1c1c1e;color:#e8e8f0;border:none;padding:12px 14px;font-family:'Fira Code','Consolas',monospace;font-size:.82rem;line-height:1.6;resize:none;outline:none;tab-size:2}
    .mini-preview{background:#fff;display:flex;flex-direction:column;border-top:2px solid var(--green)}
    iframe#learnPreview{flex:1;border:none;background:#fff}

    @media(max-width:800px){
      .workspace{grid-template-columns:1fr;grid-template-rows:1fr 1fr}
      .preview-pane{border-left:none;border-top:2px solid var(--accent)}
      .learn-page.active{grid-template-columns:1fr;grid-template-rows:auto 1fr}
      .learn-panel{border-right:none;border-bottom:1px solid var(--line2);max-height:50vh}
    }
  </style>
</head>
<body>

<header class="header">
  <div class="header-in">
    <a href="/" class="brand">비숑버프</a>
    <nav class="nav">
      <a href="/">홈</a>
      <a href="/calc">복리계산기</a>
      <a href="/lotto-gen">로또</a>
    </nav>
  </div>
</header>

<!-- 모드 탭바 -->
<div class="modebar">
  <button class="mode-tab active" onclick="setMode('editor')">💻 자유 에디터</button>
  <div class="mode-sep"></div>
  <button class="mode-tab" onclick="setMode('learn')">📚 강의 모드</button>
</div>

<!-- ══ 자유 에디터 모드 ══ -->
<div id="editorMode" style="display:flex;flex-direction:column;flex:1;overflow:hidden">
  <div class="editor-toolbar">
    <span class="toolbar-title">💻 코드 에디터</span>
    <select class="example-select" id="exampleSelect" onchange="loadExample(this.value)">
      <option value="">예제 불러오기</option>
      <option value="hello">Hello World</option>
      <option value="counter">카운터</option>
      <option value="flexbox">Flexbox</option>
      <option value="calculator">계산기</option>
      <option value="clock">디지털 시계</option>
      <option value="todo">할일 목록</option>
    </select>
    <button class="clear-btn" onclick="clearAll()">초기화</button>
    <button class="run-btn" onclick="runCode()">▶ 실행</button>
  </div>
  <div class="tab-bar">
    <button class="ed-tab active" onclick="switchTab('html',this)">HTML</button>
    <button class="ed-tab" onclick="switchTab('css',this)">CSS</button>
    <button class="ed-tab" onclick="switchTab('js',this)">JavaScript</button>
  </div>
  <div class="workspace" id="workspace">
    <div class="editor-pane" id="paneHtml">
      <textarea class="code" id="codeHtml" spellcheck="false" placeholder="HTML 코드..."></textarea>
    </div>
    <div class="editor-pane hidden" id="paneCss">
      <textarea class="code" id="codeCss" spellcheck="false" placeholder="CSS 코드..."></textarea>
    </div>
    <div class="editor-pane hidden" id="paneJs">
      <textarea class="code" id="codeJs" spellcheck="false" placeholder="JavaScript 코드..."></textarea>
    </div>
    <div class="preview-pane" id="previewPane">
      <div class="preview-label">▶ 미리보기</div>
      <iframe id="preview" sandbox="allow-scripts allow-modals"></iframe>
    </div>
  </div>
</div>

<!-- ══ 강의 모드 ══ -->
<div class="learn-page" id="learnMode">
  <!-- 왼쪽: 강의 내용 -->
  <div class="learn-panel">
    <div class="learn-nav">
      <button class="learn-nav-btn active" onclick="switchLesson('html',this)">🟠 HTML</button>
      <button class="learn-nav-btn" onclick="switchLesson('css',this)">🔵 CSS</button>
      <button class="learn-nav-btn" onclick="switchLesson('js',this)">🟣 JavaScript</button>
    </div>

    <!-- HTML 강의 -->
    <div class="lesson active" id="lesson-html">
      <h2>HTML 기초 <span class="badge badge-html">HyperText Markup Language</span></h2>
      <p class="subtitle">웹페이지의 뼈대를 만드는 언어입니다.</p>

      <h3>1. HTML이란?</h3>
      <p>HTML은 웹페이지의 <strong>구조</strong>를 만드는 언어입니다. 태그(tag)로 내용을 감싸서 의미를 부여합니다.</p>
      <div class="code-block"><span class="comment">&lt;!-- 기본 구조 --&gt;</span>
<span class="tag">&lt;!DOCTYPE html&gt;</span>
<span class="tag">&lt;html&gt;</span>
  <span class="tag">&lt;head&gt;</span>
    <span class="tag">&lt;title&gt;</span>페이지 제목<span class="tag">&lt;/title&gt;</span>
  <span class="tag">&lt;/head&gt;</span>
  <span class="tag">&lt;body&gt;</span>
    화면에 보이는 내용
  <span class="tag">&lt;/body&gt;</span>
<span class="tag">&lt;/html&gt;</span></div>

      <h3>2. 제목 태그 (h1~h6)</h3>
      <p>제목을 표시합니다. h1이 가장 크고, h6이 가장 작습니다.</p>
      <div class="code-block"><span class="tag">&lt;h1&gt;</span>가장 큰 제목<span class="tag">&lt;/h1&gt;</span>
<span class="tag">&lt;h2&gt;</span>두 번째 제목<span class="tag">&lt;/h2&gt;</span>
<span class="tag">&lt;h3&gt;</span>세 번째 제목<span class="tag">&lt;/h3&gt;</span></div>
      <button class="try-btn" onclick="tryLearn('h1')">▶ 직접 해보기</button>

      <h3>3. 문단과 텍스트</h3>
      <div class="code-block"><span class="tag">&lt;p&gt;</span>일반 문단입니다.<span class="tag">&lt;/p&gt;</span>
<span class="tag">&lt;strong&gt;</span>굵은 글씨<span class="tag">&lt;/strong&gt;</span>
<span class="tag">&lt;em&gt;</span>기울어진 글씨<span class="tag">&lt;/em&gt;</span>
<span class="tag">&lt;br&gt;</span> <span class="comment">&lt;!-- 줄바꿈 --&gt;</span></div>
      <button class="try-btn" onclick="tryLearn('text')">▶ 직접 해보기</button>

      <h3>4. 링크와 이미지</h3>
      <div class="code-block"><span class="comment">&lt;!-- 링크 --&gt;</span>
<span class="tag">&lt;a</span> <span class="attr">href=</span><span class="value">"https://example.com"</span><span class="tag">&gt;</span>
  클릭하세요
<span class="tag">&lt;/a&gt;</span>

<span class="comment">&lt;!-- 이미지 --&gt;</span>
<span class="tag">&lt;img</span> <span class="attr">src=</span><span class="value">"이미지URL"</span> <span class="attr">alt=</span><span class="value">"설명"</span><span class="tag">&gt;</span></div>
      <button class="try-btn" onclick="tryLearn('link')">▶ 직접 해보기</button>

      <h3>5. 목록</h3>
      <div class="code-block"><span class="comment">&lt;!-- 순서 없는 목록 --&gt;</span>
<span class="tag">&lt;ul&gt;</span>
  <span class="tag">&lt;li&gt;</span>항목 1<span class="tag">&lt;/li&gt;</span>
  <span class="tag">&lt;li&gt;</span>항목 2<span class="tag">&lt;/li&gt;</span>
<span class="tag">&lt;/ul&gt;</span>

<span class="comment">&lt;!-- 순서 있는 목록 --&gt;</span>
<span class="tag">&lt;ol&gt;</span>
  <span class="tag">&lt;li&gt;</span>첫 번째<span class="tag">&lt;/li&gt;</span>
  <span class="tag">&lt;li&gt;</span>두 번째<span class="tag">&lt;/li&gt;</span>
<span class="tag">&lt;/ol&gt;</span></div>
      <button class="try-btn" onclick="tryLearn('list')">▶ 직접 해보기</button>

      <h3>6. div와 span</h3>
      <p>레이아웃을 나누는 데 사용하는 컨테이너 태그입니다.</p>
      <div class="code-block"><span class="tag">&lt;div&gt;</span> <span class="comment">&lt;!-- 블록 요소, 줄 차지 --&gt;</span>
  내용
<span class="tag">&lt;/div&gt;</span>

<span class="tag">&lt;span&gt;</span> <span class="comment">&lt;!-- 인라인 요소, 줄 안에 --&gt;</span>
  내용
<span class="tag">&lt;/span&gt;</span></div>

      <h3>7. 입력 폼</h3>
      <div class="code-block"><span class="tag">&lt;input</span> <span class="attr">type=</span><span class="value">"text"</span> <span class="attr">placeholder=</span><span class="value">"입력하세요"</span><span class="tag">&gt;</span>
<span class="tag">&lt;input</span> <span class="attr">type=</span><span class="value">"number"</span><span class="tag">&gt;</span>
<span class="tag">&lt;input</span> <span class="attr">type=</span><span class="value">"checkbox"</span><span class="tag">&gt;</span>
<span class="tag">&lt;button&gt;</span>버튼<span class="tag">&lt;/button&gt;</span>
<span class="tag">&lt;select&gt;</span>
  <span class="tag">&lt;option&gt;</span>옵션1<span class="tag">&lt;/option&gt;</span>
<span class="tag">&lt;/select&gt;</span></div>
      <button class="try-btn" onclick="tryLearn('form')">▶ 직접 해보기</button>

      <div class="tip">💡 <strong>핵심 정리:</strong> HTML은 여는 태그 &lt;tag&gt; 와 닫는 태그 &lt;/tag&gt; 사이에 내용을 넣습니다. img, br, input 등 일부 태그는 닫는 태그가 없습니다.</div>
    </div>

    <!-- CSS 강의 -->
    <div class="lesson" id="lesson-css">
      <h2>CSS 기초 <span class="badge badge-css">Cascading Style Sheets</span></h2>
      <p class="subtitle">웹페이지에 색상, 크기, 레이아웃 등 스타일을 입히는 언어입니다.</p>

      <h3>1. CSS 문법</h3>
      <div class="code-block"><span class="comment">/* 선택자 { 속성: 값; } */</span>
<span class="prop">h1</span> {
  <span class="attr">color</span>: <span class="value">red</span>;
  <span class="attr">font-size</span>: <span class="value">24px</span>;
}</div>
      <button class="try-btn" onclick="tryLearn('css-basic')">▶ 직접 해보기</button>

      <h3>2. 색상과 배경</h3>
      <div class="code-block"><span class="prop">p</span> {
  <span class="attr">color</span>: <span class="value">#333333</span>;       <span class="comment">/* 글자색 */</span>
  <span class="attr">background</span>: <span class="value">#f5f5f7</span>;  <span class="comment">/* 배경색 */</span>
  <span class="attr">background</span>: <span class="value">rgba(0,113,227,.1)</span>; <span class="comment">/* 투명도 */</span>
}</div>
      <button class="try-btn" onclick="tryLearn('css-color')">▶ 직접 해보기</button>

      <h3>3. 박스 모델</h3>
      <p>모든 HTML 요소는 박스입니다. padding(안쪽), border(테두리), margin(바깥쪽)으로 구성됩니다.</p>
      <div class="code-block"><span class="prop">div</span> {
  <span class="attr">width</span>: <span class="value">200px</span>;
  <span class="attr">height</span>: <span class="value">100px</span>;
  <span class="attr">padding</span>: <span class="value">20px</span>;       <span class="comment">/* 안쪽 여백 */</span>
  <span class="attr">border</span>: <span class="value">2px solid #333</span>; <span class="comment">/* 테두리 */</span>
  <span class="attr">margin</span>: <span class="value">10px</span>;        <span class="comment">/* 바깥 여백 */</span>
  <span class="attr">border-radius</span>: <span class="value">12px</span>; <span class="comment">/* 둥근 모서리 */</span>
}</div>
      <button class="try-btn" onclick="tryLearn('css-box')">▶ 직접 해보기</button>

      <h3>4. 텍스트 스타일</h3>
      <div class="code-block"><span class="prop">p</span> {
  <span class="attr">font-size</span>: <span class="value">16px</span>;
  <span class="attr">font-weight</span>: <span class="value">700</span>;    <span class="comment">/* 굵기: 100~900 */</span>
  <span class="attr">font-family</span>: <span class="value">sans-serif</span>;
  <span class="attr">line-height</span>: <span class="value">1.8</span>;   <span class="comment">/* 줄 간격 */</span>
  <span class="attr">text-align</span>: <span class="value">center</span>;
  <span class="attr">letter-spacing</span>: <span class="value">-.02em</span>;
}</div>

      <h3>5. Flexbox 레이아웃</h3>
      <p>요소를 가로/세로로 정렬하는 강력한 레이아웃 시스템입니다.</p>
      <div class="code-block"><span class="prop">.container</span> {
  <span class="attr">display</span>: <span class="value">flex</span>;
  <span class="attr">justify-content</span>: <span class="value">center</span>;  <span class="comment">/* 가로 정렬 */</span>
  <span class="attr">align-items</span>: <span class="value">center</span>;     <span class="comment">/* 세로 정렬 */</span>
  <span class="attr">gap</span>: <span class="value">16px</span>;               <span class="comment">/* 간격 */</span>
  <span class="attr">flex-wrap</span>: <span class="value">wrap</span>;          <span class="comment">/* 줄바꿈 */</span>
}</div>
      <button class="try-btn" onclick="tryLearn('css-flex')">▶ 직접 해보기</button>

      <h3>6. 선택자 종류</h3>
      <div class="code-block"><span class="prop">p</span> { }           <span class="comment">/* 태그 선택자 */</span>
<span class="prop">.box</span> { }        <span class="comment">/* 클래스 선택자 */</span>
<span class="prop">#title</span> { }      <span class="comment">/* id 선택자 */</span>
<span class="prop">p:hover</span> { }     <span class="comment">/* 마우스 올릴 때 */</span>
<span class="prop">div &gt; p</span> { }    <span class="comment">/* div 바로 안의 p */</span></div>

      <h3>7. 애니메이션</h3>
      <div class="code-block"><span class="prop">.box</span> {
  <span class="attr">transition</span>: <span class="value">all 0.3s ease</span>;
}
<span class="prop">.box:hover</span> {
  <span class="attr">transform</span>: <span class="value">scale(1.1)</span>;
  <span class="attr">background</span>: <span class="value">#0071e3</span>;
}</div>
      <button class="try-btn" onclick="tryLearn('css-anim')">▶ 직접 해보기</button>

      <div class="tip">💡 <strong>핵심 정리:</strong> CSS는 선택자로 요소를 고른 뒤, { } 안에 속성: 값; 형태로 스타일을 지정합니다. 클래스(.name)를 잘 활용하면 재사용이 쉬워집니다.</div>
    </div>

    <!-- JS 강의 -->
    <div class="lesson" id="lesson-js">
      <h2>JavaScript 기초 <span class="badge badge-js">JS</span></h2>
      <p class="subtitle">웹페이지에 동작과 상호작용을 추가하는 프로그래밍 언어입니다.</p>

      <h3>1. 변수 선언</h3>
      <div class="code-block"><span class="keyword">let</span> name = <span class="str">'홍길동'</span>;    <span class="comment">// 변경 가능</span>
<span class="keyword">const</span> PI = <span class="num">3.14</span>;        <span class="comment">// 변경 불가</span>
<span class="keyword">let</span> count = <span class="num">0</span>;
<span class="keyword">let</span> isOk = <span class="keyword">true</span>;

console.<span class="fn">log</span>(name);       <span class="comment">// 콘솔 출력</span></div>

      <h3>2. 조건문</h3>
      <div class="code-block"><span class="keyword">let</span> age = <span class="num">20</span>;

<span class="keyword">if</span> (age >= <span class="num">18</span>) {
  console.<span class="fn">log</span>(<span class="str">'성인입니다'</span>);
} <span class="keyword">else if</span> (age >= <span class="num">13</span>) {
  console.<span class="fn">log</span>(<span class="str">'청소년입니다'</span>);
} <span class="keyword">else</span> {
  console.<span class="fn">log</span>(<span class="str">'어린이입니다'</span>);
}</div>
      <button class="try-btn" onclick="tryLearn('js-if')">▶ 직접 해보기</button>

      <h3>3. 반복문</h3>
      <div class="code-block"><span class="comment">// for 반복</span>
<span class="keyword">for</span> (<span class="keyword">let</span> i = <span class="num">0</span>; i < <span class="num">5</span>; i++) {
  console.<span class="fn">log</span>(i);  <span class="comment">// 0,1,2,3,4</span>
}

<span class="comment">// 배열 반복</span>
<span class="keyword">const</span> fruits = [<span class="str">'사과'</span>, <span class="str">'바나나'</span>, <span class="str">'딸기'</span>];
fruits.<span class="fn">forEach</span>(f => console.<span class="fn">log</span>(f));</div>
      <button class="try-btn" onclick="tryLearn('js-loop')">▶ 직접 해보기</button>

      <h3>4. 함수</h3>
      <div class="code-block"><span class="comment">// 함수 선언</span>
<span class="keyword">function</span> <span class="fn">greet</span>(name) {
  <span class="keyword">return</span> <span class="str">'안녕, '</span> + name + <span class="str">'!'</span>;
}

<span class="comment">// 화살표 함수</span>
<span class="keyword">const</span> <span class="fn">add</span> = (a, b) => a + b;

console.<span class="fn">log</span>(<span class="fn">greet</span>(<span class="str">'철수'</span>));  <span class="comment">// 안녕, 철수!</span>
console.<span class="fn">log</span>(<span class="fn">add</span>(<span class="num">3</span>, <span class="num">5</span>));      <span class="comment">// 8</span></div>

      <h3>5. DOM 조작</h3>
      <p>HTML 요소를 JavaScript로 선택하고 변경합니다.</p>
      <div class="code-block"><span class="comment">// 요소 선택</span>
<span class="keyword">const</span> el = document.<span class="fn">getElementById</span>(<span class="str">'myId'</span>);
<span class="keyword">const</span> el2 = document.<span class="fn">querySelector</span>(<span class="str">'.myClass'</span>);

<span class="comment">// 내용 변경</span>
el.textContent = <span class="str">'새로운 내용'</span>;
el.style.color = <span class="str">'red'</span>;

<span class="comment">// 클래스 추가/제거</span>
el.<span class="fn">classList.add</span>(<span class="str">'active'</span>);
el.<span class="fn">classList.remove</span>(<span class="str">'active'</span>);</div>
      <button class="try-btn" onclick="tryLearn('js-dom')">▶ 직접 해보기</button>

      <h3>6. 이벤트</h3>
      <div class="code-block"><span class="keyword">const</span> btn = document.<span class="fn">getElementById</span>(<span class="str">'btn'</span>);

<span class="comment">// 클릭 이벤트</span>
btn.<span class="fn">addEventListener</span>(<span class="str">'click'</span>, () => {
  <span class="fn">alert</span>(<span class="str">'버튼 클릭!'</span>);
});

<span class="comment">// 입력 이벤트</span>
input.<span class="fn">addEventListener</span>(<span class="str">'input'</span>, (e) => {
  console.<span class="fn">log</span>(e.target.value);
});</div>
      <button class="try-btn" onclick="tryLearn('js-event')">▶ 직접 해보기</button>

      <h3>7. 배열과 객체</h3>
      <div class="code-block"><span class="comment">// 배열</span>
<span class="keyword">const</span> arr = [<span class="num">1</span>, <span class="num">2</span>, <span class="num">3</span>];
arr.<span class="fn">push</span>(<span class="num">4</span>);          <span class="comment">// 추가</span>
arr.<span class="fn">filter</span>(n => n > <span class="num">2</span>); <span class="comment">// [3, 4]</span>
arr.<span class="fn">map</span>(n => n * <span class="num">2</span>);   <span class="comment">// [2, 4, 6, 8]</span>

<span class="comment">// 객체</span>
<span class="keyword">const</span> user = {
  name: <span class="str">'철수'</span>,
  age: <span class="num">25</span>,
  <span class="fn">greet</span>() { <span class="keyword">return</span> <span class="str">'안녕!'</span>; }
};
console.<span class="fn">log</span>(user.name);  <span class="comment">// 철수</span></div>

      <div class="tip">💡 <strong>핵심 정리:</strong> JavaScript는 HTML 요소를 선택(querySelector)하고, 이벤트(addEventListener)를 통해 사용자의 행동에 반응하며, DOM을 조작해 화면을 바꿉니다.</div>
    </div>
  </div>

  <!-- 오른쪽: 강의 실습 에디터 -->
  <div class="learn-editor">
    <div class="learn-toolbar">
      <span style="font-size:.85rem;font-weight:700;color:#ebebf5;flex:1">✏️ 실습 에디터</span>
      <button class="run-btn" onclick="runLearn()">▶ 실행</button>
    </div>
    <div class="learn-split">
      <div class="mini-editor">
        <div class="mini-label"><span>코드</span> <small style="color:#8e8e93">예제를 수정해보세요</small></div>
        <textarea class="mini-code" id="learnCode" spellcheck="false"></textarea>
      </div>
      <div class="mini-preview">
        <div class="preview-label">▶ 결과</div>
        <iframe id="learnPreview" sandbox="allow-scripts allow-modals"></iframe>
      </div>
    </div>
  </div>
</div>

<script>
  // ── 예제 데이터 ──
  const EXAMPLES = {
    hello: {
      html:\`<h1>안녕하세요! 👋</h1>\\n<p>여기에 HTML을 작성해보세요.</p>\\n<button onclick="greet()">클릭!</button>\`,
      css:\`body{\\n  font-family:sans-serif;\\n  padding:20px;\\n  background:#f5f5f7;\\n}\\nh1{color:#0071e3;}\\nbutton{\\n  margin-top:12px;padding:10px 20px;\\n  background:#0071e3;color:#fff;\\n  border:none;border-radius:8px;\\n  font-size:1rem;cursor:pointer;\\n}\`,
      js:\`function greet(){\\n  alert('환영합니다! 🎉');\\n}\`
    },
    counter: {
      html:\`<div class="wrap">\\n  <h2>카운터</h2>\\n  <div class="num" id="num">0</div>\\n  <div class="btns">\\n    <button onclick="ch(-1)">−</button>\\n    <button onclick="ch(1)">+</button>\\n  </div>\\n</div>\`,
      css:\`body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f5f5f7}\\n.wrap{text-align:center;background:#fff;padding:40px;border-radius:20px;box-shadow:0 4px 20px rgba(0,0,0,.08)}\\n.num{font-size:5rem;font-weight:800;color:#0071e3;margin:16px 0}\\n.btns{display:flex;gap:10px;justify-content:center}\\nbutton{padding:12px 28px;font-size:1.3rem;border:none;border-radius:10px;background:#0071e3;color:#fff;cursor:pointer;font-weight:700}\`,
      js:\`let n=0;\\nfunction ch(d){n+=d;document.getElementById('num').textContent=n;}\`
    },
    flexbox: {
      html:\`<div class="container">\\n  <div class="box">1</div>\\n  <div class="box">2</div>\\n  <div class="box">3</div>\\n  <div class="box wide">4 (넓음)</div>\\n  <div class="box">5</div>\\n</div>\`,
      css:\`body{font-family:sans-serif;padding:20px;background:#f5f5f7}\\n.container{\\n  display:flex;\\n  flex-wrap:wrap;\\n  gap:12px;\\n}\\n.box{\\n  background:#0071e3;color:#fff;\\n  padding:20px;border-radius:10px;\\n  font-weight:700;font-size:1.1rem;\\n  flex:1 1 100px;text-align:center;\\n}\\n.wide{flex:2 1 200px;background:#30d158;}\`,
      js:\`// CSS의 flex 속성을 바꿔보세요!\`
    },
    calculator: {
      html:\`<div class="calc">\\n  <input id="d" readonly>\\n  <div class="k">\\n    <button onclick="cl()">C</button><button onclick="ip('/')">÷</button><button onclick="ip('*')">×</button><button onclick="ip('-')">−</button>\\n    <button onclick="ip('7')">7</button><button onclick="ip('8')">8</button><button onclick="ip('9')">9</button><button onclick="ip('+')">+</button>\\n    <button onclick="ip('4')">4</button><button onclick="ip('5')">5</button><button onclick="ip('6')">6</button>\\n    <button onclick="ip('1')">1</button><button onclick="ip('2')">2</button><button onclick="ip('3')">3</button>\\n    <button onclick="ip('0')" class="z">0</button><button onclick="ip('.')">.</button><button onclick="ca()" class="eq">=</button>\\n  </div>\\n</div>\`,
      css:\`body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#1c1c1e}\\n.calc{background:#2c2c2e;border-radius:20px;padding:20px;width:240px}\\ninput{width:100%;background:none;border:none;color:#fff;font-size:2rem;text-align:right;padding:10px 4px 20px;outline:none}\\n.k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}\\nbutton{background:#3a3a3c;color:#fff;border:none;border-radius:10px;padding:16px;font-size:1rem;cursor:pointer;font-weight:500}\\n.eq{background:#0071e3;font-weight:700}\\n.z{grid-column:span 2}\`,
      js:\`const d=document.getElementById('d');\\nfunction ip(v){d.value+=v}\\nfunction cl(){d.value=''}\\nfunction ca(){try{d.value=eval(d.value)}catch{d.value='오류'}}\`
    },
    clock: {
      html:\`<div class="clock">\\n  <div id="time">00:00:00</div>\\n  <div id="date"></div>\\n</div>\`,
      css:\`body{display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#1c1c1e;font-family:monospace}\\n.clock{text-align:center}\\n#time{font-size:4rem;font-weight:300;color:#fff;letter-spacing:.05em}\\n#date{font-size:1rem;color:#8e8e93;margin-top:10px}\`,
      js:\`function update(){\\n  const n=new Date();\\n  const pad=v=>String(v).padStart(2,'0');\\n  document.getElementById('time').textContent=\\n    pad(n.getHours())+':'+pad(n.getMinutes())+':'+pad(n.getSeconds());\\n  document.getElementById('date').textContent=\\n    n.getFullYear()+'.'+(n.getMonth()+1)+'.'+n.getDate();\\n}\\nupdate();\\nsetInterval(update,1000);\`
    },
    todo: {
      html:\`<div class="app">\\n  <h2>할일 목록</h2>\\n  <div class="inp">\\n    <input id="i" placeholder="할일을 입력하세요" onkeydown="if(event.key==='Enter')add()">\\n    <button onclick="add()">추가</button>\\n  </div>\\n  <ul id="list"></ul>\\n</div>\`,
      css:\`body{font-family:sans-serif;display:flex;justify-content:center;padding:40px 16px;background:#f5f5f7}\\n.app{background:#fff;border-radius:16px;padding:24px;width:100%;max-width:360px;box-shadow:0 4px 20px rgba(0,0,0,.08)}\\nh2{margin-bottom:16px;color:#1d1d1f}\\n.inp{display:flex;gap:8px;margin-bottom:16px}\\ninput{flex:1;border:1px solid #e8e8eb;border-radius:8px;padding:8px 12px;font-size:.9rem;outline:none}\\nbutton{background:#0071e3;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:600}\\nul{list-style:none;padding:0}\\nli{padding:10px 12px;border:1px solid #e8e8eb;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;font-size:.9rem}\\nli.done{text-decoration:line-through;color:#aaa}\\n.del{background:none;border:none;color:#ff453a;cursor:pointer;font-size:.8rem}\`,
      js:\`function add(){\\n  const i=document.getElementById('i');\\n  if(!i.value.trim())return;\\n  const li=document.createElement('li');\\n  li.innerHTML=\\\`<span onclick="this.parentElement.classList.toggle('done')" style="cursor:pointer">\\\${i.value}</span><button class="del" onclick="this.parentElement.remove()">삭제</button>\\\`;\\n  document.getElementById('list').appendChild(li);\\n  i.value='';\\n}\`
    }
  };

  // 강의 실습 예제
  const LEARN_EXAMPLES = {
    h1: \`<h1>가장 큰 제목</h1>\\n<h2>두 번째 제목</h2>\\n<h3>세 번째 제목</h3>\\n<p>일반 문단입니다.</p>\`,
    text: \`<p>일반 문단입니다.</p>\\n<p><strong>굵은 글씨</strong>와 <em>기울어진 글씨</em></p>\\n<p>줄바꿈은<br>이렇게 합니다.</p>\`,
    link: \`<a href="https://bichonbuff.com" target="_blank">비숑버프 방문하기</a>\\n<br><br>\\n<img src="https://via.placeholder.com/200x100" alt="예시 이미지">\`,
    list: \`<h3>좋아하는 음식</h3>\\n<ul>\\n  <li>피자</li>\\n  <li>파스타</li>\\n  <li>라멘</li>\\n</ul>\\n<h3>학습 순서</h3>\\n<ol>\\n  <li>HTML</li>\\n  <li>CSS</li>\\n  <li>JavaScript</li>\\n</ol>\`,
    form: \`<input type="text" placeholder="이름 입력"><br><br>\\n<input type="number" placeholder="나이"><br><br>\\n<input type="checkbox"> 동의합니다<br><br>\\n<button>제출</button>\`,
    'css-basic': \`<style>\\nh1 { color: #0071e3; font-size: 2rem; }\\np { color: #555; font-size: 1.1rem; line-height: 1.8; }\\n</style>\\n<h1>CSS로 스타일 입히기</h1>\\n<p>색상과 크기를 바꿔보세요!</p>\`,
    'css-color': \`<style>\\n.box1 { background: #0071e3; color: white; padding: 20px; margin: 10px; }\\n.box2 { background: rgba(0,113,227,.15); color: #0071e3; padding: 20px; margin: 10px; }\\n.box3 { background: linear-gradient(135deg, #0071e3, #30d158); color: white; padding: 20px; margin: 10px; }\\n</style>\\n<div class="box1">단색 배경</div>\\n<div class="box2">반투명 배경</div>\\n<div class="box3">그라디언트 배경</div>\`,
    'css-box': \`<style>\\n.box {\\n  width: 200px;\\n  height: 100px;\\n  padding: 20px;\\n  border: 2px solid #0071e3;\\n  margin: 20px;\\n  border-radius: 12px;\\n  background: #e8f4fd;\\n  box-shadow: 0 4px 12px rgba(0,0,0,.1);\\n}\\n</style>\\n<div class="box">박스 모델 예제<br>padding, border, margin을 바꿔보세요</div>\`,
    'css-flex': \`<style>\\nbody { font-family: sans-serif; padding: 20px; }\\n.flex { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }\\n.item { background: #0071e3; color: white; padding: 20px 28px; border-radius: 10px; font-weight: 700; }\\n</style>\\n<div class="flex">\\n  <div class="item">아이템 1</div>\\n  <div class="item">아이템 2</div>\\n  <div class="item">아이템 3</div>\\n</div>\`,
    'css-anim': \`<style>\\nbody { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }\\n.box {\\n  width: 120px; height: 120px;\\n  background: #0071e3;\\n  border-radius: 16px;\\n  display: flex; align-items: center; justify-content: center;\\n  color: white; font-weight: 700; font-size: 1rem;\\n  cursor: pointer;\\n  transition: all 0.3s ease;\\n}\\n.box:hover {\\n  transform: scale(1.15) rotate(5deg);\\n  background: #30d158;\\n  border-radius: 50%;\\n}\\n</style>\\n<div class="box">호버해보세요</div>\`,
    'js-if': \`<style>body{font-family:sans-serif;padding:20px}</style>\\n<input type="number" id="age" placeholder="나이 입력" style="padding:8px;border:1px solid #ccc;border-radius:6px;font-size:1rem">\\n<button onclick="check()" style="padding:8px 16px;background:#0071e3;color:#fff;border:none;border-radius:6px;cursor:pointer;margin-left:8px">확인</button>\\n<p id="result" style="margin-top:16px;font-size:1.1rem;font-weight:700"></p>\\n<script>\\nfunction check(){\\n  const age = parseInt(document.getElementById('age').value);\\n  const result = document.getElementById('result');\\n  if(age >= 65) result.textContent = '👴 노년입니다';\\n  else if(age >= 18) result.textContent = '🙋 성인입니다';\\n  else if(age >= 13) result.textContent = '🧒 청소년입니다';\\n  else result.textContent = '👶 어린이입니다';\\n}\\n<\\/script>\`,
    'js-loop': \`<style>body{font-family:sans-serif;padding:20px}.item{padding:8px 16px;margin:4px;background:#e8f4fd;border-radius:6px;display:inline-block;color:#0071e3;font-weight:600}</style>\\n<h3>1~10 숫자</h3>\\n<div id="nums"></div>\\n<h3>과일 목록</h3>\\n<div id="fruits"></div>\\n<script>\\nconst numsDiv = document.getElementById('nums');\\nfor(let i=1; i<=10; i++){\\n  numsDiv.innerHTML += '<span class=\\"item\\">'+i+'</span>';\\n}\\nconst fruits = ['🍎 사과','🍌 바나나','🍓 딸기','🍊 오렌지','🍇 포도'];\\nconst fruitsDiv = document.getElementById('fruits');\\nfruits.forEach(f => {\\n  fruitsDiv.innerHTML += '<span class=\\"item\\">'+f+'</span>';\\n});\\n<\\/script>\`,
    'js-dom': \`<style>body{font-family:sans-serif;padding:20px}.box{padding:20px;border-radius:12px;background:#e8f4fd;margin:12px 0;font-size:1.1rem;transition:all .3s}</style>\\n<div class="box" id="box">저를 클릭해보세요!</div>\\n<button onclick="changeText()" style="padding:8px 16px;background:#0071e3;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-right:8px">텍스트 변경</button>\\n<button onclick="changeColor()" style="padding:8px 16px;background:#30d158;color:#fff;border:none;border-radius:8px;cursor:pointer">색상 변경</button>\\n<script>\\nconst box = document.getElementById('box');\\nconst colors = ['#e8f4fd','#fff3e0','#f3e5f5','#e8f5e9'];\\nlet ci = 0;\\nfunction changeText(){\\n  box.textContent = '텍스트가 바뀌었어요! ✨ ' + new Date().toLocaleTimeString();\\n}\\nfunction changeColor(){\\n  ci = (ci+1) % colors.length;\\n  box.style.background = colors[ci];\\n}\\n<\\/script>\`,
    'js-event': \`<style>body{font-family:sans-serif;padding:20px}#result{margin-top:16px;padding:12px;border-radius:8px;background:#f5f5f7;min-height:40px}input{padding:8px 12px;border:1px solid #ccc;border-radius:8px;width:200px;font-size:1rem}button{padding:8px 16px;background:#0071e3;color:#fff;border:none;border-radius:8px;cursor:pointer;margin-left:8px}</style>\\n<input type="text" id="inp" placeholder="타이핑해보세요">\\n<button id="btn">클릭!</button>\\n<div id="result">여기에 결과가 표시됩니다</div>\\n<script>\\nconst inp = document.getElementById('inp');\\nconst btn = document.getElementById('btn');\\nconst result = document.getElementById('result');\\ninp.addEventListener('input', (e) => {\\n  result.textContent = '입력 중: ' + e.target.value;\\n});\\nbtn.addEventListener('click', () => {\\n  result.textContent = '버튼 클릭됨! 입력값: ' + inp.value;\\n  result.style.background = '#e8f4fd';\\n});\\n<\\/script>\`
  };

  // ── 모드 전환 ──
  function setMode(mode) {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('editorMode').style.display = mode === 'editor' ? 'flex' : 'none';
    document.getElementById('learnMode').classList.toggle('active', mode === 'learn');
  }

  // ── 에디터: 탭 전환 ──
  let activeTab = 'html';
  function switchTab(tab, btn) {
    activeTab = tab;
    document.querySelectorAll('.ed-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    ['Html','Css','Js'].forEach(t => {
      document.getElementById('pane'+t).classList.toggle('hidden', t.toLowerCase() !== tab);
    });
  }

  function runCode() {
    const h = document.getElementById('codeHtml').value;
    const c = document.getElementById('codeCss').value;
    const j = document.getElementById('codeJs').value;
    document.getElementById('preview').srcdoc =
      \`<!DOCTYPE html><html><head><style>\${c}</style></head><body>\${h}<script>\${j}<\\/script></body></html>\`;
  }

  function clearAll() {
    if (!confirm('코드를 모두 초기화할까요?')) return;
    ['codeHtml','codeCss','codeJs'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('preview').srcdoc = '';
    document.getElementById('exampleSelect').value = '';
  }

  function loadExample(key) {
    if (!key) return;
    const ex = EXAMPLES[key];
    if (!ex) return;
    document.getElementById('codeHtml').value = ex.html;
    document.getElementById('codeCss').value = ex.css;
    document.getElementById('codeJs').value = ex.js;
    runCode();
  }

  // ── 강의: 탭 전환 ──
  function switchLesson(lang, btn) {
    document.querySelectorAll('.learn-nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.lesson').forEach(l => l.classList.remove('active'));
    document.getElementById('lesson-'+lang).classList.add('active');
  }

  // ── 강의: 실습 예제 로드 ──
  function tryLearn(key) {
    const code = LEARN_EXAMPLES[key] || '';
    document.getElementById('learnCode').value = code;
    runLearn();
  }

  function runLearn() {
    const code = document.getElementById('learnCode').value;
    document.getElementById('learnPreview').srcdoc =
      \`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:16px}</style></head><body>\${code}</body></html>\`;
  }

  // Tab 키 들여쓰기
  document.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart;
        ta.value = ta.value.substring(0, s) + '  ' + ta.value.substring(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 2;
      }
    });
  });

  // 초기 예제 로드
  loadExample('hello');
  tryLearn('h1');
</script>
</body>
</html>
`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return html(renderNotFoundPage(), 404);
    } catch (e) {
      return json({ error: "server_error", detail: String(e?.message || e) }, 500);
    }
  },
};

async function handleApi(request, env, url) {
  const db = env.DB;
  const path = url.pathname;
  const method = request.method;

  if (method === "POST" && path === "/api/auth/login") {
    const body = await safeJson(request);
    const password = String(body?.password || "");
    const settings = await getBlogSettings(db);

    const savedHash = settings.admin_password_hash || "";
    const envHash = env.ADMIN_PASSWORD_HASH || "";
    const envPlain = env.ADMIN_PASSWORD || "";

    let ok = false;
    // 운영 편의: Worker Secret을 최우선으로 사용
    if (envPlain) ok = password === envPlain;
    else if (envHash) ok = (await sha256(password)) === envHash;
    else if (savedHash) ok = (await sha256(password)) === savedHash;

    if (!ok) return json({ error: "invalid password" }, 401);

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await db
      .prepare("INSERT INTO sessions (id, token, role, expires_at, created_at) VALUES (?, ?, 'admin', ?, datetime('now'))")
      .bind(randomId(), token, expiresAt)
      .run();

    return json({ success: true, token, expires_at: expiresAt });
  }

  if (method === "POST" && path === "/api/auth/logout") {
    const token = bearerToken(request);
    if (token) await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return json({ success: true });
  }

  if (method === "GET" && path === "/api/settings") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    return json({ success: true, settings: await getBlogSettings(db) });
  }

  if (method === "PUT" && path === "/api/settings") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;

    const body = await safeJson(request);
    const allowedKeys = [
      "blog_name",
      "blog_description",
      "profile_name",
      "profile_image",
      "theme_color",
      "font_family",
      "font_size_px",
      "adsense_code",
      "ad_top_html",
      "ad_mid_html",
      "ad_bottom_html",
      "google_verification",
      "naver_verification",
      "api_key",
      "turtlebuff_api_key",
      "naver_client_id",
      "naver_client_secret",
      "categories",
      "indexnow_key",
    ];

    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        await upsertSetting(db, key, String(body[key] ?? ""));
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "admin_password")) {
      const next = String(body.admin_password || "").trim();
      if (next.length < 6) return json({ error: "admin_password must be at least 6 chars" }, 400);
      await upsertSetting(db, "admin_password_hash", await sha256(next));
    }

    _settingsCache = null; // 설정 변경 시 캐시 무효화
    await purgePageCache(url); // 설정 변경 시 페이지 엣지 캐시도 퍼지
    return json({ success: true, settings: await getBlogSettings(db) });
  }

  if (method === "GET" && path === "/api/posts") {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const status = String(url.searchParams.get("status") || "published");
    const catFilter = url.searchParams.get("cat") || "";
    const searchFilter = url.searchParams.get("q") || "";

    if (status !== "published") {
      const admin = await requireAdmin(request, db);
      if (!admin.ok) return admin.res;
    }

    const offset = (page - 1) * limit;
    let rows;
    if (status === "published") {
      let sql = "SELECT id, title, slug, excerpt, category, thumbnail, status, views, source, publish_at, created_at, updated_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))";
      const binds = [];
      if (catFilter) { sql += " AND category = ?"; binds.push(catFilter); }
      if (searchFilter) { sql += " AND (INSTR(title, ?) > 0 OR INSTR(excerpt, ?) > 0)"; binds.push(searchFilter, searchFilter); }
      sql += " ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ? OFFSET ?";
      binds.push(limit, offset);
      rows = await db.prepare(sql).bind(...binds).all();
    } else if (status === "scheduled") {
      rows = await db
        .prepare(
          "SELECT id, title, slug, excerpt, category, thumbnail, status, views, source, publish_at, created_at, updated_at FROM posts WHERE status = 'scheduled' AND (publish_at IS NULL OR publish_at > datetime('now')) ORDER BY publish_at ASC LIMIT ? OFFSET ?"
        )
        .bind(limit, offset)
        .all();
    } else {
      rows = await db
        .prepare(
          "SELECT id, title, slug, excerpt, category, thumbnail, status, views, source, publish_at, created_at, updated_at FROM posts WHERE status = ? ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ? OFFSET ?"
        )
        .bind(status, limit, offset)
        .all();
    }

    return json({ success: true, posts: rows.results || [], page, limit });
  }

  if (method === "POST" && path === "/api/posts") {
    const auth = await requireAdminOrApiKey(request, db, env);
    if (!auth.ok) return auth.res;

    const body = await safeJson(request);
    const title = String(body?.title || "").trim();
    const content = extractBodyContent(String(body?.content || "").trim());
    const category = String(body?.category || "").trim();
    const source = String(body?.source || (auth.mode === "api" ? "automation" : "manual"));
    const requestedStatus = normalizePostStatus(body?.status);
    const publishParsed = parsePublishAt(body?.publish_at);
    if (!publishParsed.ok) return json({ error: publishParsed.error }, 400);
    let status = requestedStatus;
    let publishAt = publishParsed.value;
    if (status === "scheduled") {
      if (!publishAt) return json({ error: "publish_at required for scheduled post" }, 400);
      const v = validateScheduleWindow(publishAt);
      if (!v.ok) return json({ error: v.error }, 400);
    } else if (status === "published" && publishAt) {
      const v = validateScheduleWindow(publishAt);
      if (v.ok && new Date(publishAt).getTime() > Date.now() + 30 * 1000) status = "scheduled";
    } else {
      publishAt = null;
    }

    if (!title || !content) return json({ error: "title and content are required" }, 400);

    const meta_description = String(body?.meta_description || "").trim();
    const og_image = String(body?.og_image || "").trim();
    const focus_keyword = String(body?.focus_keyword || "").trim();
    const tags = String(body?.tags || "").trim();
    const rawContent = extractBodyContent(String(body?.content || "").trim());
    const wc = stripHtml(rawContent).length;
    const word_count = body?.word_count || wc;
    const reading_time = body?.reading_time || Math.ceil(wc / 500);

    const slugBase = slugify(String(body?.slug || title));
    const slug = await ensureUniqueSlug(db, slugBase);
    const excerpt = String(body?.excerpt || stripHtml(content).slice(0, 160));
    const thumbnail = String(body?.thumbnail || "").trim();

    const result = await db
      .prepare(
        "INSERT INTO posts (title, slug, content, excerpt, category, thumbnail, status, views, source, publish_at, meta_description, og_image, focus_keyword, tags, reading_time, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
      )
      .bind(title, slug, content, excerpt, category, thumbnail, status, source, publishAt ? toSqliteDateTime(publishAt) : null, meta_description, og_image, focus_keyword, tags, reading_time, word_count)
      .run();

    const id = result.meta?.last_row_id;
    const created = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    await purgePageCache(url, created?.slug);
    if (status === "published" && created?.slug) {
      const origin = `${url.protocol}//${url.host}`;
      await notifySearchEngines(origin, created.slug, db);
    }
    return json({ success: true, post: created }, 201);
  }

  if (path.startsWith("/api/posts/") && path.endsWith("/export") && method === "GET") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    const idStr = path.replace("/api/posts/", "").replace("/export", "");
    const id = Number(idStr);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);
    const post = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    if (!post) return json({ error: "not found" }, 404);

    const settings = await getBlogSettings(db);
    const exported = renderExportHtml(settings, post);
    return new Response(exported, {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(post.slug || "post")}.html"`,
      },
    });
  }

  if (path.startsWith("/api/posts/") && path.endsWith("/optimize") && method === "POST") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    const idStr = path.replace("/api/posts/", "").replace("/optimize", "");
    const id = Number(idStr);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);

    const post = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    if (!post) return json({ error: "not found" }, 404);

    const body = await safeJson(request);
    const keyword = String(body?.keyword || "").trim();
    if (!keyword) return json({ error: "keyword required" }, 400);

    const report = buildSeoReport(post.title, post.content, keyword);
    const optimizedTitle = optimizeTitle(post.title, keyword);
    const optimizedContent = optimizeContent(post.content, keyword);

    await db
      .prepare("UPDATE posts SET title = ?, content = ?, excerpt = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(optimizedTitle, optimizedContent, stripHtml(optimizedContent).slice(0, 160), id)
      .run();

    const updated = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    return json({ success: true, report, post: updated, applied: true });
  }

  if (method === "POST" && path === "/api/seo/analyze") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;

    const body = await safeJson(request);
    const title = String(body?.title || "").trim();
    const content = String(body?.content || "").trim();
    const keyword = String(body?.keyword || "").trim();

    if (!title || !content || !keyword) return json({ error: "title, content, keyword required" }, 400);

    const localReport = buildSeoReport(title, content, keyword);
    const naverStats = await checkNaverKeywordCount(db, env, keyword);

    return json({ success: true, local: localReport, naver: naverStats });
  }

  if (method === "GET" && path === "/api/stats") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    const totalPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts").first();
    const publishedPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))").first();
    const scheduledPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts WHERE status='scheduled' AND (publish_at IS NULL OR publish_at > datetime('now'))").first();
    const draftPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts WHERE status='draft'").first();
    const totalViews = await db.prepare("SELECT COALESCE(SUM(views),0) as total FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))").first();
    const topPosts = await db.prepare("SELECT id, title, slug, views, publish_at, created_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY views DESC LIMIT 10").all();
    const recentPosts = await db.prepare("SELECT id, title, status, created_at FROM posts ORDER BY created_at DESC LIMIT 10").all();
    const catStats = await db.prepare("SELECT COALESCE(category,'미분류') as category, COUNT(*) as cnt, COALESCE(SUM(views),0) as views FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) GROUP BY category ORDER BY cnt DESC").all();
    return json({
      success: true,
      stats: {
        total_posts: totalPosts?.cnt || 0,
        published_posts: publishedPosts?.cnt || 0,
        scheduled_posts: scheduledPosts?.cnt || 0,
        draft_posts: draftPosts?.cnt || 0,
        total_views: totalViews?.total || 0,
        top_posts: topPosts?.results || [],
        recent_posts: recentPosts?.results || [],
        category_stats: catStats?.results || []
      }
    });
  }

  if (method === "POST" && path === "/api/media/upload") {
    const auth = await requireAdminOrApiKey(request, db, env);
    if (!auth.ok) return auth.res;
    if (!env.MEDIA) return json({ error: "R2 binding (MEDIA) missing" }, 500);
    const ct = request.headers.get("Content-Type") || "";
    if (!ct.includes("multipart/form-data")) return json({ error: "multipart/form-data required" }, 400);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return json({ error: "file field required" }, 400);
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) return json({ error: "unsupported image type: " + file.type }, 400);
    if (file.size > 10 * 1024 * 1024) return json({ error: "file too large (max 10MB)" }, 400);
    const ext = (file.name || "img").split(".").pop() || "jpg";
    const key = "media/" + Date.now() + "-" + randomId().slice(0, 8) + "." + ext;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const imageUrl = "/" + key;
    return json({ success: true, url: imageUrl, html: `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" />`, key });
  }

  if (method === "POST" && path === "/api/media/url") {
    const auth = await requireAdminOrApiKey(request, db, env);
    if (!auth.ok) return auth.res;
    const body = await safeJson(request);
    const raw = String(body?.url || "").trim();
    if (!raw) return json({ error: "url required" }, 400);

    const type = detectUrlType(raw);
    if (type === "image") {
      const htmlSnippet = `<img src="${escapeHtml(raw)}" alt="" loading="lazy" />`;
      return json({ success: true, type, html: htmlSnippet });
    }
    if (type === "video") {
      const htmlSnippet = videoEmbedHtml(raw);
      return json({ success: true, type, html: htmlSnippet });
    }
    return json({ success: true, type: "link", html: `<a href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer">${escapeHtml(raw)}</a>` });
  }

  if (path.startsWith("/api/posts/")) {
    const id = parseInt(path.replace("/api/posts/", ""), 10);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);

    if (method === "GET") {
      const post = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
      if (!post) return json({ error: "not found" }, 404);
      if (!(post.status === "published" || post.status === "scheduled")) {
        const admin = await requireAdmin(request, db);
        if (!admin.ok) return admin.res;
      } else if (post.status === "scheduled" && post.publish_at && new Date(post.publish_at).getTime() > Date.now()) {
        const admin = await requireAdmin(request, db);
        if (!admin.ok) return admin.res;
      }
      return json({ success: true, post });
    }

    if (method === "PUT") {
      const admin = await requireAdmin(request, db);
      if (!admin.ok) return admin.res;

      const current = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
      if (!current) return json({ error: "not found" }, 404);

      const body = await safeJson(request);
      const title = body?.title !== undefined ? String(body.title).trim() : current.title;
      const content = body?.content !== undefined ? extractBodyContent(String(body.content).trim()) : current.content;
      const excerpt = body?.excerpt !== undefined ? String(body.excerpt).trim() : current.excerpt;
      const category = body?.category !== undefined ? String(body.category).trim() : current.category;
      const thumbnail = body?.thumbnail !== undefined ? String(body.thumbnail).trim() : current.thumbnail;
      const requestedStatus = body?.status !== undefined ? normalizePostStatus(body.status) : current.status;
      const publishRaw = body?.publish_at !== undefined ? body.publish_at : current.publish_at;
      const publishParsed = parsePublishAt(publishRaw);
      if (!publishParsed.ok) return json({ error: publishParsed.error }, 400);
      let status = requestedStatus;
      let publishAt = publishParsed.value;
      if (status === "scheduled") {
        if (!publishAt) return json({ error: "publish_at required for scheduled post" }, 400);
        const v = validateScheduleWindow(publishAt);
        if (!v.ok) return json({ error: v.error }, 400);
      } else if (status === "published") {
        // 발행으로 명시적 변경 시 publish_at 초기화 (예약→발행 전환 지원)
        publishAt = null;
      } else {
        publishAt = null;
      }
      const meta_description = body?.meta_description !== undefined ? String(body.meta_description).trim() : current.meta_description;
      const og_image = body?.og_image !== undefined ? String(body.og_image).trim() : current.og_image;
      const focus_keyword = body?.focus_keyword !== undefined ? String(body.focus_keyword).trim() : current.focus_keyword;
      const tags = body?.tags !== undefined ? String(body.tags).trim() : current.tags;
      const word_count = body?.word_count !== undefined ? body.word_count : current.word_count;
      const reading_time = body?.reading_time !== undefined ? body.reading_time : current.reading_time;

      let slug = current.slug;

      if (body?.slug !== undefined) {
        const candidate = slugify(String(body.slug || title));
        slug = await ensureUniqueSlug(db, candidate, id);
      } else if (body?.title !== undefined) {
        const candidate = slugify(title);
        slug = await ensureUniqueSlug(db, candidate, id);
      }

      await db
        .prepare(
          "UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, thumbnail = ?, status = ?, publish_at = ?, meta_description = ?, og_image = ?, focus_keyword = ?, tags = ?, reading_time = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(title, slug, content, excerpt || stripHtml(content).slice(0, 160), category, thumbnail, status, publishAt ? toSqliteDateTime(publishAt) : null, meta_description, og_image, focus_keyword, tags, reading_time, word_count, id)
        .run();

      const updated = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
      await purgePageCache(url, updated?.slug, current?.slug);
      if (status === "published" && updated?.slug) {
        const origin = `${url.protocol}//${url.host}`;
        await notifySearchEngines(origin, updated.slug, db);
      }
      return json({ success: true, post: updated });
    }

    if (method === "DELETE") {
      const admin = await requireAdmin(request, db);
      if (!admin.ok) return admin.res;

      // R2 이미지 삭제: content에서 /media/ URL 추출 후 R2에서 제거
      if (env.MEDIA) {
        try {
          const post = await db.prepare("SELECT content, thumbnail FROM posts WHERE id = ?").bind(id).first();
          if (post) {
            const keys = new Set();
            // content 내 /media/ 이미지 추출
            const mediaRe = /\/media\/[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+/g;
            if (post.content) {
              for (const m of post.content.matchAll(mediaRe)) keys.add(m[0].slice(1));
            }
            // thumbnail도 /media/ 경로면 추가
            if (post.thumbnail && post.thumbnail.startsWith("/media/")) {
              keys.add(post.thumbnail.slice(1));
            }
            // R2에서 삭제 (병렬)
            if (keys.size > 0) {
              await Promise.allSettled([...keys].map(k => env.MEDIA.delete(k)));
            }
          }
        } catch (e) {
          console.error("R2 cleanup error:", e);
          // R2 삭제 실패해도 DB 삭제는 진행
        }
      }

      // 캐시 퍼지용 slug 조회
      const delPost = await db.prepare("SELECT slug FROM posts WHERE id = ?").bind(id).first();
      await db.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
      await purgePageCache(url, delPost?.slug);
      return json({ success: true });
    }
  }

  // 조회수 조회 API (GET: 조회만, POST: 증가+조회)
  if (path.match(/^\/api\/posts\/\d+\/view$/)) {
    const id = parseInt(path.replace("/api/posts/", "").replace("/view", ""), 10);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);
    if (method === "POST") {
      await db.prepare("UPDATE posts SET views = COALESCE(views, 0) + 1 WHERE id = ?").bind(id).run();
    }
    const row = await db.prepare("SELECT views FROM posts WHERE id = ?").bind(id).first();
    return json({ success: true, views: Number(row?.views || 0) });
  }

  // 댓글 API
  if (path === "/api/comments" && method === "GET") {
    const slug = url.searchParams.get("slug");
    if (!slug) return json({ error: "slug required" }, 400);
    const rows = await db.prepare("SELECT id, parent_id, author_name, content, created_at FROM comments WHERE post_slug = ? AND approved = 1 ORDER BY created_at ASC").bind(slug).all();
    return json({ success: true, comments: rows.results || [] });
  }

  if (path === "/api/comments" && method === "POST") {
    const body = await safeJson(request);
    const slug = String(body?.slug || "").trim();
    const authorName = String(body?.author_name || "").trim().slice(0, 50);
    const content = String(body?.content || "").trim().slice(0, 1000);
    const parentId = body?.parent_id ? parseInt(body.parent_id, 10) : null;
    if (!slug || !authorName || !content) return json({ error: "slug, author_name, content required" }, 400);
    await db.prepare("INSERT INTO comments (post_slug, parent_id, author_name, content) VALUES (?, ?, ?, ?)").bind(slug, parentId || null, authorName, content).run();
    return json({ success: true });
  }

  if (path.startsWith("/api/comments/") && method === "DELETE") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    const id = parseInt(path.replace("/api/comments/", ""), 10);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);
    await db.prepare("DELETE FROM comments WHERE id = ?").bind(id).run();
    return json({ success: true });
  }

  return json({ error: "not_found" }, 404);
}

async function handlePostDetail(db, slug, url) {
  const post = await db
    .prepare("SELECT * FROM posts WHERE slug = ? AND (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) LIMIT 1")
    .bind(slug)
    .first();

  if (!post) return html(renderNotFoundPage(), 404);

  const origin = `${url.protocol}//${url.host}`;
  const [settings, relatedPosts] = await Promise.all([
    getBlogSettings(db),
    getRelatedPosts(db, post.id, post.category, 3)
  ]);
  return html(renderPostPage(settings, post, relatedPosts, origin), 200, { "Cache-Control": "public, s-maxage=3600, max-age=0, must-revalidate" });
}

async function getRelatedPosts(db, currentId, category, limit) {
  if (!category) return [];
  const rows = await db
    .prepare("SELECT id, title, slug, excerpt, thumbnail, category, publish_at, created_at FROM posts WHERE category = ? AND id != ? AND (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ?")
    .bind(category, currentId, limit)
    .all();
  return rows.results || [];
}

async function handleSitemap(db, url) {
  const origin = `${url.protocol}//${url.host}`;
  const rows = await db
    .prepare("SELECT slug, updated_at, created_at, publish_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY COALESCE(publish_at, created_at) DESC")
    .all();

  const now = formatKSTDate(new Date().toISOString());
  const homePage = `<url><loc>${escapeXml(origin)}/</loc><lastmod>${escapeXml(now)}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`;
  const items = (rows.results || [])
    .map((p) => {
      const dt = formatKSTDate(p.updated_at || p.publish_at || p.created_at);
      return `<url><loc>${escapeXml(origin + "/posts/" + p.slug)}</loc><lastmod>${escapeXml(dt)}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
    })
    .join("");

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${homePage}${items}</urlset>`;
  return new Response(xmlContent, { headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}

async function handleRss(db, url) {
  const origin = `${url.protocol}//${url.host}`;
  const settings = await getBlogSettings(db);
  const rows = await db
    .prepare("SELECT title, slug, excerpt, publish_at, created_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY COALESCE(publish_at, created_at) DESC LIMIT 30")
    .all();

  const items = (rows.results || [])
    .map((p) => {
      const link = `${origin}/posts/${p.slug}`;
      return [
        "<item>",
        `<title>${escapeXml(p.title || "")}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid>${escapeXml(link)}</guid>`,
        `<description>${escapeXml(p.excerpt || "")}</description>`,
        `<pubDate>${escapeXml(new Date(p.publish_at || p.created_at || Date.now()).toUTCString())}</pubDate>`,
        "</item>",
      ].join("");
    })
    .join("");

  const title = settings.blog_name || "Blog";
  const desc = settings.blog_description || "";
  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escapeXml(title)}</title><link>${escapeXml(origin)}</link><description>${escapeXml(desc)}</description>${items}</channel></rss>`;
  return new Response(rssContent, { headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

async function runMigrations(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT UNIQUE, content TEXT, excerpt TEXT, category TEXT, thumbnail TEXT, status TEXT DEFAULT 'draft', views INTEGER DEFAULT 0, source TEXT DEFAULT 'manual', publish_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) )"
  ).run();
  try {
    await db.prepare("ALTER TABLE posts ADD COLUMN publish_at TEXT").run();
  } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN meta_description TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN og_image TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN focus_keyword TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN tags TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN reading_time INTEGER DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN word_count INTEGER DEFAULT 0").run(); } catch {}

  await db.prepare("CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_posts_publish_at ON posts(publish_at)").run();

  await db.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token TEXT UNIQUE, role TEXT, expires_at TEXT, created_at TEXT DEFAULT (datetime('now'))) ").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_slug TEXT NOT NULL, parent_id INTEGER DEFAULT NULL, author_name TEXT NOT NULL, content TEXT NOT NULL, approved INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')))").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(post_slug, approved, created_at)").run();
  // 카테고리 기본값 업데이트 (구버전 '복지정책' → 새 카테고리로)
  try {
    await db.prepare("UPDATE settings SET value = ? WHERE key = 'categories' AND value = '복지정책'").bind("건강관리,재테크,생활정보,멘탈헬스,반려동물,뷰티건강,속보뉴스").run();
  } catch {}

  const defaults = {
    blog_name: "관리자 - 설정 - 블로그 이름 바꿔주세요",
    blog_description: "관리자 - 설정 - 블로그 설명 바꿔주세요",
    profile_name: "관리자 - 설정 - 이름 바꿔주세요",
    profile_image: "",
    theme_color: "#111111",
    font_family: "",
    font_size_px: "18",
    adsense_code: "",
    ad_top_html: "",
    ad_mid_html: "",
    ad_bottom_html: "",
    google_verification: "",
    naver_verification: "",
    api_key: randomToken(),
    turtlebuff_api_key: randomToken(),
    naver_client_id: "",
    naver_client_secret: "",
    categories: "건강관리,재테크,생활정보,멘탈헬스,반려동물,뷰티건강,속보뉴스",
    indexnow_key: randomToken(),
  };

  for (const [k, v] of Object.entries(defaults)) {
    await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").bind(k, v).run();
  }

  // 기존 글 excerpt 재생성 (CSS 텍스트 오염 수정)
  try {
    const rows = await db.prepare("SELECT id, content FROM posts WHERE excerpt LIKE '%.hero-img%' OR excerpt LIKE '%margin:%' OR excerpt LIKE '%border-radius%'").all();
    for (const row of (rows.results || [])) {
      const newExcerpt = stripHtml(row.content || "").slice(0, 160);
      await db.prepare("UPDATE posts SET excerpt = ? WHERE id = ?").bind(newExcerpt, row.id).run();
    }
  } catch {}
}

async function requireAdmin(request, db) {
  const token = bearerToken(request);
  if (!token) return { ok: false, res: json({ error: "unauthorized" }, 401) };

  const session = await db
    .prepare("SELECT token, expires_at FROM sessions WHERE token = ? AND role = 'admin' LIMIT 1")
    .bind(token)
    .first();

  if (!session) return { ok: false, res: json({ error: "unauthorized" }, 401) };
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return { ok: false, res: json({ error: "session expired" }, 401) };
  }
  return { ok: true };
}

async function requireAdminOrApiKey(request, db, env) {
  const admin = await requireAdmin(request, db);
  if (admin.ok) return { ok: true, mode: "admin" };

  const apiKey = request.headers.get("X-API-Key") || "";
  if (!apiKey) return { ok: false, res: json({ error: "unauthorized" }, 401) };

  const settings = await getBlogSettings(db);
  const valid = [settings.api_key, settings.turtlebuff_api_key, env.TURTLEBUFF_API_KEY].filter(Boolean);
  if (valid.includes(apiKey)) return { ok: true, mode: "api" };
  return { ok: false, res: json({ error: "invalid api key" }, 401) };
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

async function purgePageCache(url, ...slugs) {
  try {
    const cache = caches.default;
    const origin = `${url.protocol}//${url.host}`;
    // 홈, 아카이브 캐시 삭제
    await cache.delete(new Request(origin + "/", { method: "GET" }));

    // 해당 글 캐시 삭제
    for (const slug of slugs) {
      if (slug) await cache.delete(new Request(origin + "/posts/" + slug, { method: "GET" }));
    }
  } catch (e) {
    // 캐시 퍼지 실패해도 무시
  }
}

async function notifySearchEngines(origin, slugOrUrl, db) {
  try {
    const settings = await getBlogSettings(db);
    const key = settings.indexnow_key || "";
    const pageUrl = slugOrUrl.startsWith("http") ? slugOrUrl : origin + "/posts/" + slugOrUrl;
    // IndexNow (Bing, Yandex, Naver 등)
    if (key) {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: new URL(origin).host, key, keyLocation: origin + "/" + key + ".txt", urlList: [pageUrl] })
      });
      const msg = {200:"OK",202:"Accepted",400:"Bad request",403:"Key invalid",422:"URL/host mismatch",429:"Too many requests"};
      console.log("[IndexNow] " + res.status + " " + (msg[res.status]||"Unknown") + " → " + pageUrl);
    }
  } catch (e) {
    // 인덱싱 알림 실패해도 무시
  }
}

async function promoteScheduledPosts(db, url) {
  try {
    // 승격 대상 slug 먼저 조회
    const targets = await db.prepare("SELECT slug FROM posts WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')").all();
    if (!targets.results || targets.results.length === 0) return;
    await db
      .prepare(
        "UPDATE posts SET status = 'published', updated_at = datetime('now') WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')"
      )
      .run();
    // 승격된 글들에 대해 검색엔진 알림
    if (url) {
      const origin = `${url.protocol}//${url.host}`;
      for (const p of targets.results) {
        if (p.slug) await notifySearchEngines(origin, p.slug, db);
      }
    }
  } catch (e) {
    // 승격 실패해도 요청 처리는 계속 진행
  }
}

async function getBlogSettings(db) {
  if (_settingsCache && Date.now() - _settingsCacheTime < SETTINGS_TTL) return _settingsCache;
  const rows = await db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  for (const r of rows.results || []) out[r.key] = r.value;
  _settingsCache = out;
  _settingsCacheTime = Date.now();
  return out;
}

async function upsertSetting(db, key, value) {
  await db
    .prepare("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value)
    .run();
}

async function getPublishedPosts(db, page, limit, category, search) {
  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
  let sql = "SELECT id, title, slug, excerpt, category, thumbnail, publish_at, created_at, views FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))";
  const binds = [];
  if (category) {
    sql += " AND category = ?";
    binds.push(category);
  }
  if (search) {
    sql += " AND (INSTR(title, ?) > 0 OR INSTR(excerpt, ?) > 0)";
    binds.push(search, search);
  }
  sql += " ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);
  const rows = await db.prepare(sql).bind(...binds).all();
  return rows.results || [];
}

async function getHomeSummary(db) {
  const published = await db
    .prepare("SELECT COUNT(*) as cnt FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))")
    .first();
  const views = await db
    .prepare("SELECT COALESCE(SUM(views),0) as total FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))")
    .first();
  return {
    published_posts: Number(published?.cnt || 0),
    total_views: Number(views?.total || 0),
  };
}

async function ensureUniqueSlug(db, base, selfId) {
  const clean = base || "post";
  let candidate = clean;
  let seq = 2;
  while (true) {
    const row = await db.prepare("SELECT id FROM posts WHERE slug = ? LIMIT 1").bind(candidate).first();
    if (!row || (selfId && Number(row.id) === Number(selfId))) return candidate;
    candidate = `${clean}-${seq}`;
    seq += 1;
  }
}

function slugify(input) {
  // 한글/영문/숫자 포함 slug 생성
  const slug = String(input || "")
    .trim()
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (slug) return slug;
  // 빈 경우: 타임스탬프 기반
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `p-${ts}-${rand}`;
}

function extractBodyContent(input) {
  const c = String(input || "").trim();
  if (!/^<!doctype\s|^<html[\s>]/i.test(c)) return c;
  const styleBlocks = Array.from(c.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi))
    .map((m) => m[0])
    .join("\n");

  const bodyMatch = c.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = "";
  if (bodyMatch) {
    body = bodyMatch[1].trim();
  } else {
    const afterHead = c.replace(/^[\s\S]*?<\/head>/i, "");
    body = afterHead
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "")
      .replace(/^<!doctype[^>]*>/i, "")
      .trim();
  }

  const cleaned = body.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  if (!styleBlocks) return cleaned;
  return `${styleBlocks}\n${cleaned}`.trim();
}

function normalizePostStatus(raw) {
  const v = String(raw || "published").toLowerCase().trim();
  if (v === "draft") return "draft";
  if (v === "scheduled") return "scheduled";
  return "published";
}

function parsePublishAt(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return { ok: true, value: null };
  const dt = new Date(String(raw).trim());
  if (!Number.isFinite(dt.getTime())) return { ok: false, error: "invalid publish_at datetime" };
  return { ok: true, value: dt.toISOString() };
}

function validateScheduleWindow(publishAtIso) {
  const ts = new Date(publishAtIso).getTime();
  if (!Number.isFinite(ts)) return { ok: false, error: "invalid publish_at datetime" };
  const now = Date.now();
  const max = now + 50 * 24 * 60 * 60 * 1000;
  if (ts < now + 30 * 1000) return { ok: false, error: "publish_at must be in the future" };
  if (ts > max) return { ok: false, error: "publish_at exceeds 50 days limit" };
  return { ok: true };
}

function toSqliteDateTime(iso) {
  return String(iso || "").replace("T", " ").slice(0, 19);
}

function formatKSTDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(' ', 'T');
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
  if (!Number.isFinite(d.getTime())) return String(dateStr).slice(0, 10);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function formatKSTDateTime(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(' ', 'T');
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
  if (!Number.isFinite(d.getTime())) return String(dateStr).slice(0, 16).replace('T', ' ');
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16).replace('T', ' ');
}

function stripHtml(input) {
  return String(input || "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(s) {
  return escapeHtml(s);
}

function randomToken() {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomId() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text) {
  const enc = new TextEncoder().encode(String(text || ""));
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function detectUrlType(raw) {
  const s = String(raw || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(s)) return "image";
  if (s.includes("youtube.com") || s.includes("youtu.be") || s.includes("vimeo.com")) return "video";
  return "link";
}

function videoEmbedHtml(raw) {
  const u = String(raw || "");
  const yt = u.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (yt) {
    const id = yt[1];
    return `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${escapeHtml(id)}" title="video" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
  }
  return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u)}</a>`;
}

function keywordDensity(text, keyword) {
  const t = stripHtml(text).toLowerCase();
  const k = String(keyword || "").toLowerCase().trim();
  if (!t || !k) return 0;
  const words = t.split(/\s+/).filter(Boolean).length || 1;
  const matches = (t.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  return Number(((matches / words) * 100).toFixed(2));
}

function buildSeoReport(title, content, keyword) {
  const titleLen = String(title || "").length;
  const textLen = stripHtml(content).length;
  const density = keywordDensity(content, keyword);
  const hasKeywordInTitle = String(title || "").toLowerCase().includes(String(keyword || "").toLowerCase());

  const suggestions = [];
  if (!hasKeywordInTitle) suggestions.push("제목에 핵심 키워드를 1회 포함하세요.");
  if (titleLen < 18 || titleLen > 42) suggestions.push("제목 길이를 18~42자로 조정하세요.");
  if (textLen < 1200) suggestions.push("본문 길이를 최소 1200자 이상으로 늘리세요.");
  if (density < 0.4) suggestions.push("키워드 언급 빈도가 낮습니다. 자연스럽게 2~4회 추가하세요.");
  if (density > 2.5) suggestions.push("키워드 과다 사용입니다. 일부를 유의어로 치환하세요.");

  const scoreBase = 100
    - (hasKeywordInTitle ? 0 : 20)
    - (titleLen < 18 || titleLen > 42 ? 10 : 0)
    - (textLen < 1200 ? 20 : 0)
    - (density < 0.4 || density > 2.5 ? 15 : 0);

  return {
    score: Math.max(10, scoreBase),
    title_length: titleLen,
    body_length: textLen,
    keyword_density_percent: density,
    has_keyword_in_title: hasKeywordInTitle,
    suggestions,
  };
}

function optimizeTitle(title, keyword) {
  const t = String(title || "").trim();
  const k = String(keyword || "").trim();
  if (!k) return t;
  if (t.toLowerCase().includes(k.toLowerCase())) return t;
  return `${k} | ${t}`.slice(0, 60);
}

function optimizeContent(content, keyword) {
  const c = String(content || "");
  const k = String(keyword || "").trim();
  if (!k) return c;
  const plain = stripHtml(c).toLowerCase();
  if (plain.includes(k.toLowerCase())) return c;
  return `<p><strong>${escapeHtml(k)}</strong> 관련 핵심 내용을 먼저 요약합니다.</p>\n` + c;
}

async function checkNaverKeywordCount(db, env, keyword) {
  const settings = await getBlogSettings(db);
  const all = [];
  if (settings.naver_client_id && settings.naver_client_secret) {
    all.push({ id: settings.naver_client_id, secret: settings.naver_client_secret });
  }
  try {
    const envApis = JSON.parse(env.NAVER_APIS || "[]");
    if (Array.isArray(envApis)) all.push(...envApis);
  } catch {}

  if (!all.length) {
    return { ok: false, message: "네이버 API 키 미설정", result_count: null };
  }

  const pick = all[Math.floor(Math.random() * all.length)];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10&sort=sim`,
      {
        headers: {
          "X-Naver-Client-Id": pick.id,
          "X-Naver-Client-Secret": pick.secret,
        },
      }
    );
    const data = await res.json();
    return {
      ok: res.ok,
      message: res.ok ? "조회 성공" : "조회 실패",
      result_count: Number(data?.total || 0),
      sample_titles: (data?.items || []).slice(0, 3).map((x) => stripHtml(x.title || "")),
    };
  } catch (e) {
    return { ok: false, message: String(e?.message || e), result_count: null };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function html(content, status = 200, extra = {}) {
  return new Response(content, {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "text/html; charset=utf-8", ...extra },
  });
}

function text(content, status = 200) {
  return new Response(content, {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

function xml(content, status = 200) {
  return new Response(content, {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/xml; charset=utf-8" },
  });
}

/* ╔══════════════════════════════════════════════════════════════════════════════╗
   ║  🔒 CORE SYSTEM 영역 끝 (END OF CORE SYSTEM)                               ║
   ║  ⚠️ 위의 모든 코드는 수정하지 마세요                                        ║
   ╚══════════════════════════════════════════════════════════════════════════════╝ */

/* ╔══════════════════════════════════════════════════════════════════════════════╗
   ║                                                                              ║
   ║  🎨  CUSTOMIZABLE ZONE - 자유롭게 수정 가능                                 ║
   ║                                                                              ║
   ║  이 영역의 HTML, CSS, 레이아웃, 색상, 폰트 등을 자유롭게 수정하세요.         ║
   ║                                                                              ║
   ║  ⚠️ 주의사항:                                                               ║
   ║  - 함수 이름과 파라미터(매개변수)는 절대 변경하지 마세요                      ║
   ║  - return 값의 기본 구조(HTML 문자열)는 유지하세요                            ║
   ║  - settings, posts 등 데이터 객체의 속성명은 변경 불가                        ║
   ║  - escapeHtml() 등 보안 함수 호출은 제거하지 마세요                           ║
   ║                                                                              ║
   ║  수정 가능한 함수 목록:                                                      ║
   ║  - renderHomePage()     : 홈페이지 (카드 레이아웃, 사이드바)                  ║
   ║  - (아카이브 페이지 제거됨)                                                    ║
   ║  - renderPostPage()     : 글 상세 페이지                                     ║
   ║  - injectMidAd()        : 본문 중간 광고 삽입 위치                            ║
   ║  - renderExportHtml()   : HTML 내보내기 템플릿                                ║
   ║  - renderAdminPage()    : 관리자 대시보드 (에디터, 설정, 통계)                ║
   ║  - renderNotFoundPage() : 404 페이지                                         ║
   ║                                                                              ║
   ╚══════════════════════════════════════════════════════════════════════════════╝ */

/* ──── 🎨 [수정 가능] 홈페이지 ────────────────────────────────────────────────
   CSS 스타일, 카드 레이아웃, 색상, 폰트, 사이드바 등을 자유롭게 변경하세요.
   ⚠️ 함수명 renderHomePage(settings, posts, summary, activeCat, searchQuery) 유지 필수
   ⚠️ settings, posts, summary 데이터 속성명 변경 불가
   사용 가능한 데이터:
     settings: blog_name, blog_description, profile_name, profile_image, categories, theme_color, ...
     posts[]: id, title, slug, excerpt, category, thumbnail, publish_at, created_at, views
     summary: published_posts, total_views
     activeCat: 현재 선택된 카테고리 (문자열 또는 빈값)
     searchQuery: 검색어 (문자열 또는 빈값)
   ────────────────────────────────────────────────────────────────────────────── */
function renderHomePage(settings, posts, summary, activeCat, searchQuery) {
  const title = settings.blog_name || "Blog";
  const desc = settings.blog_description || "";
  const profileName = settings.profile_name || "Admin";
  const profileImage = settings.profile_image || "";
  const ogImage = profileImage || (posts.length && posts[0].thumbnail ? posts[0].thumbnail : "");
  const cats = (settings.categories || "").split(",").map(c => c.trim()).filter(Boolean);

  const cards = posts.length
    ? posts
        .map(
          (p, i) => {
            const cleanExcerpt = stripHtml(p.excerpt || "").slice(0, 80);
            return `
      <article class="card" style="animation-delay:${Math.min(i * 0.04, 0.28)}s">
        <a href="/posts/${escapeHtml(p.slug)}" class="card-link">
          <div class="thumb">${p.thumbnail ? `<img src="${escapeHtml(p.thumbnail)}" alt="${escapeHtml(p.title)}" width="741" height="413" ${i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} />` : `<div class="thumb-empty"></div>`}</div>
          <div class="card-body">
            <h3>${escapeHtml(p.title)}</h3>
            <p class="excerpt">${escapeHtml(cleanExcerpt)}</p>
            <div class="meta"><span class="cat">${escapeHtml(p.category || "일반")}</span><span class="dot"></span>${escapeHtml(formatKSTDate(p.publish_at || p.created_at))}</div>
          </div>
        </a>
        <div class="admin-tools" data-admin><a href="/admin#edit-${p.id}">수정</a><button class="del" onclick="event.stopPropagation();if(!confirm('이 글을 삭제하시겠습니까?'))return;fetch('/api/posts/${p.id}',{method:'DELETE',headers:{'Authorization':'Bearer '+localStorage.getItem('admin_token')}}).then(r=>r.json()).then(d=>{if(d.success)location.reload();else alert('삭제 실패: '+(d.error||''))}).catch(e=>alert('삭제 오류: '+e.message))">삭제</button></div>
      </article>`;
          }
        )
        .join("")
    : `<div class="empty">아직 발행된 글이 없습니다.</div>`;

  const catLinks = `<a href="/" class="side-cat${!activeCat?' active':''}">#전체</a>` + cats.map(c => `<a href="/?cat=${encodeURIComponent(c)}" class="side-cat${activeCat===c?' active':''}">${escapeHtml(c)}</a>`).join("");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": title,
    "description": desc,
    "url": "/",
    "blogPost": posts.slice(0, 10).map(p => ({
      "@type": "BlogPosting",
      "headline": p.title,
      "url": "/posts/" + p.slug,
      "datePublished": p.created_at,
      "image": p.thumbnail || "",
      "author": { "@type": "Person", "name": profileName }
    }))
  });

  const adTop = settings.ad_top_html || "";
  const adBottom = settings.ad_bottom_html || "";
  const stats = summary || { published_posts: 0, total_views: 0 };
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<meta name="robots" content="index,follow" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(desc)}" />
<meta property="og:site_name" content="${escapeHtml(title)}" />
<meta property="og:url" content="/" />
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(desc)}" />
${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ""}
${settings.google_verification ? `<meta name="google-site-verification" content="${escapeHtml(settings.google_verification)}" />` : ""}
${settings.naver_verification ? `<meta name="naver-site-verification" content="${escapeHtml(settings.naver_verification)}" />` : ""}
<link rel="canonical" href="https://bichonbuff.com/" />
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(title)} RSS" href="/rss.xml" />
<script type="application/ld+json">${jsonLd}</script>

<style>
:root{--bg:#fff;--bg2:#f5f5f7;--card:#fff;--line:#d2d2d7;--line2:#e8e8eb;--muted:#86868b;--txt:#1d1d1f;--accent:#0071e3}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:var(--bg);color:var(--txt);-webkit-font-smoothing:antialiased}
/* Header */
.header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}
.header-in{max-width:1200px;margin:0 auto;padding:13px 28px;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;font-size:1.15rem;letter-spacing:-.03em;color:var(--txt);text-decoration:none}.side-cat.active{background:var(--primary,#111);color:#fff}
.nav{display:flex;gap:20px;align-items:center}
.nav a{color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:500;transition:color .15s}
.nav a:hover{color:var(--txt)}
.nav .pill{padding:6px 14px;border-radius:999px;background:var(--txt);color:#fff;font-weight:600;font-size:.8rem}
.nav .pill:hover{opacity:.85;color:#fff}
/* Layout */
.layout{max-width:1200px;margin:0 auto;padding:32px 28px 60px;display:grid;grid-template-columns:220px 1fr;gap:40px}
/* Sidebar */
.sidebar{position:sticky;top:80px;align-self:start}
.profile{text-align:center;margin-bottom:28px}
.profile-img{width:72px;height:72px;border-radius:50%;object-fit:cover;background:var(--bg2);border:1px solid var(--line2)}
.profile-initials{width:72px;height:72px;border-radius:50%;background:var(--txt);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;margin:0 auto}
.profile-name{margin:10px 0 2px;font-size:.95rem;font-weight:700;letter-spacing:-.02em}
.profile-desc{font-size:.78rem;color:var(--muted);line-height:1.5}
.side-section{margin-bottom:20px}
.side-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-left:2px}
.side-cat{display:block;padding:6px 10px;font-size:.84rem;color:var(--txt);text-decoration:none;border-radius:8px;font-weight:500;transition:background .12s}
.side-cat:hover{background:var(--bg2)}
.side-link{display:block;padding:5px 10px;font-size:.8rem;color:var(--muted);text-decoration:none;font-weight:500;transition:color .12s}
.side-link:hover{color:var(--txt)}
.admin-tools{display:none;gap:5px;padding:0 14px 10px}
.admin-tools a,.admin-tools button{font-size:.72rem;padding:3px 8px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid var(--line2);color:var(--muted);background:#fff;cursor:pointer}
.admin-tools a:hover,.admin-tools button:hover{background:var(--txt);color:#fff;border-color:var(--txt)}
.admin-tools .del{color:#e53e3e;border-color:#fed7d7}
.admin-tools .del:hover{background:#e53e3e;color:#fff;border-color:#e53e3e}
/* Main */
.main-area h1{font-size:2rem;font-weight:800;letter-spacing:-.04em;margin:0 0 6px}
.main-area .desc{color:var(--muted);font-size:.92rem;margin:0 0 24px;line-height:1.5}
.filter-info{padding:10px 14px;background:var(--bg2);border-radius:10px;font-size:.88rem;color:var(--muted);margin-bottom:14px}.filter-info a{color:var(--txt);font-weight:600;margin-left:8px;text-decoration:none}.filter-info a:hover{text-decoration:underline}
.side-search{display:flex;gap:6px}.side-search input{flex:1;padding:7px 10px;border:1px solid var(--line2);border-radius:8px;font-size:.84rem;outline:none;background:var(--bg2)}.side-search input:focus{border-color:var(--txt)}.side-search button{padding:7px 12px;border:none;border-radius:8px;background:var(--txt);color:#fff;font-size:.8rem;font-weight:600;cursor:pointer}
.visit-strip{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0 0}
.visit-card{border:1px solid var(--line2);border-radius:12px;background:#fff;padding:10px 12px}
.visit-label{font-size:.72rem;color:var(--muted);margin-bottom:3px}
.visit-num{font-size:1.08rem;font-weight:800;letter-spacing:-.02em}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.card{background:var(--card);border:1px solid var(--line2);border-radius:14px;overflow:hidden;transform:translateY(6px);opacity:0;animation:up .5s ease forwards;transition:box-shadow .2s,transform .2s}
.card:hover{box-shadow:0 6px 24px rgba(0,0,0,.06);transform:translateY(-2px)}
.card-link{display:block;text-decoration:none;color:inherit}
.card-body{padding:14px 16px 12px}
.card h3{margin:0 0 5px;font-size:.92rem;font-weight:700;letter-spacing:-.02em;color:var(--txt);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4}
.card .excerpt{margin:0 0 8px;color:var(--muted);font-size:.8rem;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .meta{font-size:.72rem;color:#a1a1a6;display:flex;align-items:center;gap:6px}
.card .meta .cat{color:var(--accent);font-weight:600}
.card .meta .dot{width:2px;height:2px;border-radius:50%;background:#a1a1a6}
.thumb{aspect-ratio:16/10;overflow:hidden;background:var(--bg2)}
.thumb img{display:block;width:100%;height:100%;object-fit:cover}
.thumb-empty{width:100%;height:100%;background:var(--bg2)}
.empty{padding:40px;text-align:center;color:var(--muted);background:var(--bg2);border-radius:14px;grid-column:1/-1;font-size:.9rem}
.write-btn{display:none;margin-bottom:20px}
.write-btn a{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:var(--txt);color:#fff;border-radius:999px;text-decoration:none;font-size:.84rem;font-weight:600;transition:opacity .15s}
.write-btn a:hover{opacity:.85}
.ad{margin:18px 0;padding:8px;border:1px dashed #e6e6ea;border-radius:12px;background:#fafafc}
@keyframes up{to{transform:translateY(0);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.menu-toggle{display:none;background:none;border:none;font-size:1.5rem;cursor:pointer;padding:4px 8px;color:var(--txt);line-height:1}
.mobile-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:99}
.mobile-overlay.open{display:block}
.mobile-menu{position:fixed;top:0;right:-300px;width:300px;height:100%;background:#fff;z-index:100;box-shadow:-4px 0 20px rgba(0,0,0,.1);padding:20px;overflow-y:auto;transition:right .25s ease}
.mobile-menu.open{right:0}
.mobile-menu .mm-close{background:none;border:none;font-size:1.3rem;cursor:pointer;float:right;padding:4px 8px;color:var(--txt)}
.mobile-menu .mm-section{margin-bottom:20px}
.mobile-menu .mm-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.mobile-menu .mm-cat{display:block;padding:8px 10px;font-size:.88rem;color:var(--txt);text-decoration:none;border-radius:8px;font-weight:500}
.mobile-menu .mm-cat:hover{background:var(--bg2)}
.mobile-menu .mm-search{display:flex;gap:6px;margin-bottom:16px}
.mobile-menu .mm-search input{flex:1;padding:8px 10px;border:1px solid var(--line2);border-radius:8px;font-size:.88rem;background:var(--bg2);outline:none}
.mobile-menu .mm-search button{padding:8px 14px;border:none;border-radius:8px;background:var(--txt);color:#fff;font-size:.84rem;font-weight:600;cursor:pointer}
@media(max-width:900px){.layout{grid-template-columns:1fr;gap:0}.sidebar{display:none}.grid{grid-template-columns:repeat(2,1fr)}.menu-toggle{display:block}}
@media(max-width:520px){.layout{padding:16px 16px 40px}.header-in{padding:11px 16px}.grid{grid-template-columns:1fr}.main-area h1{font-size:1.6rem}}
</style>
<meta name="google-adsense-account" content="ca-pub-3425189666333844">
${settings.adsense_code || ""}
</head>
<body>
<header class="header"><div class="header-in"><a href="/" class="brand">${escapeHtml(title)}</a><nav class="nav"><a href="/">홈</a><a href="/admin" class="pill">관리자</a><button class="menu-toggle" onclick="openMenu()">☰</button></nav></div></header>
${cats.length ? `<div style="background:#fff;border-bottom:1px solid #e8e8eb;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none"><div style="max-width:1280px;margin:0 auto;padding:0 20px;display:flex;align-items:stretch;white-space:nowrap"><div style="display:flex;align-items:center"><span style="font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px">카테고리</span>${cats.map(c=>`<a href="/?cat=${encodeURIComponent(c)}" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap${activeCat===c?';color:#0071e3;border-bottom-color:#0071e3;font-weight:700':''}">${escapeHtml(c)}</a>`).join('')}</div><div style="width:1px;background:#e8e8eb;margin:8px 4px;align-self:stretch"></div><div style="display:flex;align-items:center"><span style="font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px">도구</span><a href="/calc" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;white-space:nowrap">💰 복리계산기</a><a href="/lotto-gen" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;white-space:nowrap">🎱 로또번호추천</a><a href="/code" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;white-space:nowrap">💻 코드연습</a></div></div></div>` : ''}
<div class="layout">
  <aside class="sidebar">
    <div class="profile">
      ${profileImage ? `<img class="profile-img" src="${escapeHtml(profileImage)}" alt="${escapeHtml(profileName)}" />` : `<div class="profile-initials">${escapeHtml(profileName.charAt(0))}</div>`}
      <div>
        <div class="profile-name">${escapeHtml(profileName)}</div>
        <div class="profile-desc">${escapeHtml(desc)}</div>
      </div>
    </div>
    <div class="side-section"><div class="side-search"><input type="text" id="sideSearch" placeholder="검색어를 입력하세요" value="${escapeHtml(searchQuery || '')}" onkeydown="if(event.key==='Enter'){var q=this.value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';}" /><button onclick="var q=document.getElementById('sideSearch').value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';">검색</button></div></div>
    ${cats.length ? `<div class="side-section"><div class="side-label">Categories</div>${catLinks}</div>` : ""}
    <section class="visit-strip">
      <div class="visit-card"><div class="visit-label">총 발행수</div><div class="visit-num">${Number(stats.published_posts || 0).toLocaleString()}</div></div>
      <div class="visit-card"><div class="visit-label">총 조회수</div><div class="visit-num">${Number(stats.total_views || 0).toLocaleString()}</div></div>
    </section>
  </aside>
  <main class="main-area">
    <div class="write-btn" data-admin><a href="/admin">+ 새 글 작성</a></div>
    ${searchQuery ? `<div class="filter-info">"${escapeHtml(searchQuery)}" 검색 결과 (${posts.length}건) <a href="/">전체보기</a></div>` : activeCat ? `<div class="filter-info">"${escapeHtml(activeCat)}" 카테고리 (${posts.length}건) <a href="/">전체보기</a></div>` : ""}
    ${adTop ? `<div class="ad">${adTop}</div>` : ""}
    <section class="grid" id="postGrid">${cards}</section>
    ${posts.length >= 12 ? '<div id="scrollSentinel" style="height:40px"></div><div id="scrollLoader" style="display:none;text-align:center;padding:24px"><svg width="28" height="28" viewBox="0 0 24 24" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="10" fill="none" stroke="#ccc" stroke-width="2.5"/><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/></svg></div>' : ''}
    ${adBottom ? `<div class="ad">${adBottom}</div>` : ""}
  </main>
</div>
<div class="mobile-overlay" id="mobileOverlay" onclick="closeMenu()"></div>
<div class="mobile-menu" id="mobileMenu">
  <button class="mm-close" onclick="closeMenu()">✕</button>
  <div style="clear:both;margin-bottom:16px"></div>
  <div class="mm-search">
    <input type="text" id="mmSearch" placeholder="검색어를 입력하세요" onkeydown="if(event.key==='Enter'){var q=this.value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';}" />
    <button onclick="var q=document.getElementById('mmSearch').value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';">검색</button>
  </div>
  ${cats.length ? `<div class="mm-section"><div class="mm-label">Categories</div>${cats.map(c => `<a href="/?cat=${encodeURIComponent(c)}" class="mm-cat">${escapeHtml(c)}</a>`).join("")}</div>` : ""}
</div>
<script>
(function(){
  if(localStorage.getItem('admin_token')){
    document.querySelectorAll('[data-admin]').forEach(function(el){el.style.display='flex'});
  }
})();
function openMenu(){document.getElementById('mobileMenu').classList.add('open');document.getElementById('mobileOverlay').classList.add('open')}
function closeMenu(){document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')}
(function(){
  var grid=document.getElementById('postGrid');
  var loader=document.getElementById('scrollLoader');
  var sentinel=document.getElementById('scrollSentinel');
  if(!grid||!sentinel)return;
  var page=2,loading=false,done=false;
  var cat=${JSON.stringify(activeCat||'')};
  var q=${JSON.stringify(searchQuery||'')};
  var isAdmin=!!localStorage.getItem('admin_token');
  function escHtml(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
  function stripH(s){var d=document.createElement('div');d.innerHTML=s;return(d.textContent||'').slice(0,80)}
  function utcToKSTDate(s){if(!s)return '';var u=String(s).trim().replace(' ','T');if(u.length<=19&&!u.endsWith('Z'))u+='Z';var d=new Date(u);if(!isFinite(d.getTime()))return String(s).slice(0,10);var k=new Date(d.getTime()+9*3600000);return k.toISOString().slice(0,10)}
  function makeCard(p){
    var excerpt=stripH(p.excerpt||'');
    var date=utcToKSTDate(p.publish_at||p.created_at||'');
    var thumb=p.thumbnail?'<img src="'+escHtml(p.thumbnail)+'" alt="'+escHtml(p.title)+'" loading="lazy" />':'<div class="thumb-empty"></div>';
    var adminHtml=isAdmin?'<div class="admin-tools" style="display:flex"><a href="/admin#edit-'+p.id+'">수정</a><button class="del" onclick="event.stopPropagation();if(!confirm(&apos;삭제?&apos;))return;fetch(&apos;/api/posts/'+p.id+'&apos;,{method:&apos;DELETE&apos;,headers:{&apos;Authorization&apos;:&apos;Bearer &apos;+localStorage.getItem(&apos;admin_token&apos;)}}).then(function(r){return r.json()}).then(function(d){if(d.success)location.reload();else alert(d.error||&apos;&apos;)}).catch(function(e){alert(e.message)})">삭제</button></div>':'';
    return '<article class="card" style="animation-delay:0s"><a href="/posts/'+escHtml(p.slug)+'" class="card-link"><div class="thumb">'+thumb+'</div><div class="card-body"><h3>'+escHtml(p.title)+'</h3><p class="excerpt">'+escHtml(excerpt)+'</p><div class="meta"><span class="cat">'+escHtml(p.category||'일반')+'</span><span class="dot"></span>'+escHtml(date)+'</div></div></a>'+adminHtml+'</article>';
  }
  function needsLoad(){
    var scrollBottom=window.innerHeight+window.pageYOffset;
    var docHeight=document.documentElement.offsetHeight;
    return scrollBottom>=docHeight-300;
  }
  function loadMore(){
    if(loading||done)return;
    loading=true;
    loader.style.display='block';
    page++;
    var apiUrl='/api/posts?page='+page+'&limit=6&status=published';
    if(cat)apiUrl+='&cat='+encodeURIComponent(cat);
    if(q)apiUrl+='&q='+encodeURIComponent(q);
    fetch(apiUrl).then(function(r){return r.json()}).then(function(data){
      loader.style.display='none';
      if(!data.posts||data.posts.length===0){done=true;sentinel.style.display='none';return}
      data.posts.forEach(function(p){grid.insertAdjacentHTML('beforeend',makeCard(p))});
      if(data.posts.length<6){done=true;sentinel.style.display='none'}
      loading=false;
    }).catch(function(){loader.style.display='none';loading=false});
  }
  window.addEventListener('scroll',function(){
    if(!done&&needsLoad())loadMore();
  });
  // 페이지 로드 시 스크롤 없이도 하단이면 즉시 로딩
  setTimeout(function(){if(!done&&needsLoad())loadMore()},300);
})();
</script>
</body>
</html>`;
}

/* ──── 🎨 [수정 가능] 글 상세 페이지 ──────────────────────────────────────────
   개별 블로그 글의 상세 페이지입니다. 본문 스타일, 레이아웃을 자유롭게 변경하세요.
   ⚠️ 함수명 renderPostPage(settings, post, relatedPosts) 유지 필수
   사용 가능한 데이터:
     settings: blog_name, blog_description, profile_name, theme_color, font_family, font_size_px,
               adsense_code, ad_top_html, ad_mid_html, ad_bottom_html, categories, ...
     post: id, title, slug, content, excerpt, category, thumbnail, status, views,
           publish_at, created_at, updated_at, meta_description, og_image, tags, word_count, reading_time
     relatedPosts[]: id, title, slug, excerpt, thumbnail, category, publish_at, created_at
   ────────────────────────────────────────────────────────────────────────────── */
function renderPostPage(settings, post, relatedPosts, origin) {
  relatedPosts = relatedPosts || [];
  const blogName = settings.blog_name || "Blog";
  const pageTitle = `${post.title} | ${blogName}`;
  const desc = stripHtml(post.excerpt || post.content || "").slice(0, 160);
  const metaDesc = post.meta_description || desc;
  const ogImage = post.og_image || post.thumbnail || "";
  const wordCount = post.word_count || stripHtml(post.content || "").length;
  const readingTime = post.reading_time || Math.ceil(wordCount / 500);
  const postTags = post.tags ? String(post.tags).split(",").map(t => t.trim()).filter(Boolean) : [];
  const siteOrigin = origin || "";
  const canonical = siteOrigin + `/posts/${post.slug}`;
  const theme = settings.theme_color || "#111111";
  const fontFamily = settings.font_family || "";
  const fontSize = Number(settings.font_size_px || 18);
  const profileName = settings.profile_name || "Admin";
  const profileImage = settings.profile_image || "";
  const cats = (settings.categories || "").split(",").map((c) => c.trim()).filter(Boolean);
  const catLinks = cats.map((c) => `<a href="/?cat=${encodeURIComponent(c)}" class="side-cat">${escapeHtml(c)}</a>`).join("");

  const adTop = settings.ad_top_html || "";
  const adMid = settings.ad_mid_html || "";
  const adBottom = settings.ad_bottom_html || "";

  const content = injectMidAd(post.content || "", adMid);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(metaDesc)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeHtml(post.title)}" />
<meta property="og:description" content="${escapeHtml(metaDesc)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="article:published_time" content="${escapeHtml(post.created_at || "")}" />
<meta property="article:section" content="${escapeHtml(post.category || "")}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(post.title)}" />
<meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:image:alt" content="${escapeHtml(post.title)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"BlogPosting","headline":post.title,"description":metaDesc,"image":ogImage,"datePublished":post.created_at||"","dateModified":post.updated_at||post.created_at||"","wordCount":wordCount,"inLanguage":"ko","keywords":postTags.join(", "),"author":{"@type":"Person","name":settings.profile_name||"Admin"},"publisher":{"@type":"Organization","name":blogName},"mainEntityOfPage":{"@type":"WebPage","@id":canonical}})}</script>
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":siteOrigin+"/"},{"@type":"ListItem","position":2,"name":post.category||"Posts","item":post.category?siteOrigin+"/?cat="+encodeURIComponent(post.category):siteOrigin+"/"},{"@type":"ListItem","position":3,"name":post.title,"item":canonical}]})}</script>
${(() => { const faqMatches = [...(post.content || "").matchAll(/<h3 class="faq-q">([\s\S]*?)<\/h3>\s*<div class="faq-a">([\s\S]*?)<\/div>/gi)]; return faqMatches.length ? `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":faqMatches.map(m => ({"@type":"Question","name":stripHtml(m[1]),"acceptedAnswer":{"@type":"Answer","text":stripHtml(m[2])}}))})}</script>` : ""; })()}
<style>
:root{--theme:${escapeHtml(theme)};--line:#ececf0;--line2:#e8e8eb;--muted:#74747d;--txt:#16161a;--bg2:#f5f5f7}
html{scroll-behavior:smooth}*{box-sizing:border-box} body{margin:0;background:#fff;color:var(--txt);font-family:${fontFamily ? escapeHtml(fontFamily) + ',' : ''}-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}
.header-in{max-width:1200px;margin:0 auto;padding:13px 28px;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;font-size:1.15rem;text-decoration:none;color:var(--txt)}
.nav{display:flex;gap:20px;align-items:center}
.nav a{color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:500}
.nav .pill{padding:6px 14px;border-radius:999px;background:#111;color:#fff}
.layout{max-width:1200px;margin:0 auto;padding:32px 28px 60px;display:grid;grid-template-columns:220px 1fr;gap:40px}
.sidebar{position:sticky;top:80px;align-self:start}
.profile{text-align:center;margin-bottom:28px}
.profile-img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid var(--line2)}
.profile-initials{width:72px;height:72px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;margin:0 auto}
.profile-name{margin:10px 0 2px;font-size:.95rem;font-weight:700}
.profile-desc{font-size:.78rem;color:var(--muted)}
.side-section{margin-bottom:20px}
.side-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.side-cat,.side-link{display:block;padding:6px 10px;font-size:.84rem;color:var(--txt);text-decoration:none;border-radius:8px}
.side-cat:hover,.side-link:hover{background:var(--bg2)}
.main{min-width:0}
.wrap{max-width:860px;padding:0 0 48px}
a{color:#2563eb;text-decoration:none}
.top{display:flex;justify-content:space-between;align-items:center;font-size:.9rem;color:#555;margin-bottom:18px}
h1{margin:0 0 14px;font-size:clamp(1.8rem,4vw,2.9rem);line-height:1.18;letter-spacing:-.03em}
.meta{color:var(--muted);font-size:.92rem;margin:0 0 20px}
.content{font-size:${Math.max(15, Math.min(24, fontSize))}px;line-height:1.86;word-break:break-word}
.content h2,.content h3{line-height:1.35;letter-spacing:-.02em}
.content img{max-width:100%;height:auto;border-radius:12px;margin:14px 0}
.content table{border-radius:0!important;overflow:visible}.content table *{border-radius:0!important}
.content a{word-break:break-all}
.video-wrap{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;margin:14px 0}
.video-wrap iframe{position:absolute;top:0;left:0;width:100%;height:100%}
.ad{margin:18px 0;padding:8px;border:1px dashed #e6e6ea;border-radius:12px;background:#fafafc}
hr{border:none;border-top:1px solid var(--line);margin:30px 0}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 0}
.act-btn{display:inline-flex;align-items:center;gap:4px;padding:8px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:#555;font-size:.84rem;font-weight:600;cursor:pointer;text-decoration:none;font-family:inherit}
.act-btn:hover{background:#111;color:#fff;border-color:#111}
.act-btn.del{color:#e53e3e;border-color:#fed7d7}
.act-btn.del:hover{background:#e53e3e;color:#fff;border-color:#e53e3e}
.act-btn.copied{background:#22c55e;color:#fff;border-color:#22c55e}
.admin-only{display:none}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}
.tag{display:inline-block;padding:4px 10px;border-radius:999px;background:var(--bg2);font-size:.78rem;color:var(--muted);font-weight:500}
.related{margin:24px 0 0;padding:20px 0 0;border-top:1px solid var(--line)}
.related h3{font-size:1rem;font-weight:700;margin:0 0 14px}
.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0;margin:0}
.related-card{border:1px solid var(--line2);border-radius:12px;overflow:hidden;transition:box-shadow .2s,transform .2s}
.related-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.related-card a{text-decoration:none;color:inherit;display:block}
.related-thumb{aspect-ratio:16/10;overflow:hidden;background:var(--bg2)}
.related-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.related-body{padding:10px 12px}
.related-body .r-title{font-size:.86rem;font-weight:700;color:var(--txt);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;margin:0 0 4px}
.related-body .r-excerpt{font-size:.76rem;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;margin:0 0 6px}
.related-body .r-meta{font-size:.7rem;color:#a1a1a6}
.content h2{position:relative}
.content h2 .heading-anchor{display:none;position:absolute;left:-1.2em;color:var(--muted);text-decoration:none;font-weight:400}
.content h2:hover .heading-anchor{display:inline}
.menu-toggle{display:none;background:none;border:none;font-size:1.5rem;cursor:pointer;padding:4px 8px;color:var(--txt);line-height:1}
.mobile-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:99}
.mobile-overlay.open{display:block}
.mobile-menu{position:fixed;top:0;right:-300px;width:300px;height:100%;background:#fff;z-index:100;box-shadow:-4px 0 20px rgba(0,0,0,.1);padding:20px;overflow-y:auto;transition:right .25s ease}
.mobile-menu.open{right:0}
.mobile-menu .mm-close{background:none;border:none;font-size:1.3rem;cursor:pointer;float:right;padding:4px 8px;color:var(--txt)}
.mobile-menu .mm-section{margin-bottom:20px}
.mobile-menu .mm-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.mobile-menu .mm-cat{display:block;padding:8px 10px;font-size:.88rem;color:var(--txt);text-decoration:none;border-radius:8px;font-weight:500}
.mobile-menu .mm-cat:hover{background:var(--bg2)}
@media(max-width:900px){.layout{grid-template-columns:1fr;gap:0}.sidebar{display:none}.menu-toggle{display:block}.related-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.related-grid{grid-template-columns:1fr}}
</style>
<meta name="google-adsense-account" content="ca-pub-3425189666333844">
${settings.adsense_code || ""}

</head>
<body>
<header class="header"><div class="header-in"><a href="/" class="brand">${escapeHtml(blogName)}</a><nav class="nav"><a href="/">홈</a><a href="/admin" class="pill">관리자</a><button class="menu-toggle" onclick="openMenu()">☰</button></nav></div></header>
${(settings.categories||"").split(",").map(c=>c.trim()).filter(Boolean).length ? `<div style="background:#fff;border-bottom:1px solid #e8e8eb;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none"><div style="max-width:1280px;margin:0 auto;padding:0 20px;display:flex;align-items:stretch;white-space:nowrap"><div style="display:flex;align-items:center"><span style="font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px">카테고리</span>${(settings.categories||"").split(",").map(c=>c.trim()).filter(Boolean).map(c=>`<a href="/?cat=${encodeURIComponent(c)}" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;border-bottom:2px solid transparent;white-space:nowrap">${escapeHtml(c)}</a>`).join("")}</div><div style="width:1px;background:#e8e8eb;margin:8px 4px;align-self:stretch"></div><div style="display:flex;align-items:center"><span style="font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px">도구</span><a href="/calc" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;white-space:nowrap">💰 복리계산기</a><a href="/lotto-gen" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;white-space:nowrap">🎱 로또번호추천</a><a href="/code" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;white-space:nowrap">💻 코드연습</a></div></div></div>` : ""}
<div class="layout">
  <aside class="sidebar">
    <div class="profile">
      ${profileImage ? `<img class="profile-img" src="${escapeHtml(profileImage)}" alt="${escapeHtml(profileName)}" />` : `<div class="profile-initials">${escapeHtml(profileName.charAt(0))}</div>`}
      <div>
        <div class="profile-name">${escapeHtml(profileName)}</div>
        <div class="profile-desc">${escapeHtml(settings.blog_description || "")}</div>
      </div>
    </div>
    ${cats.length ? `<div class="side-section"><div class="side-label">Categories</div>${catLinks}</div>` : ""}
  </aside>
  <main class="main">
    <div class="wrap">
      <div class="top"><a href="/">← 목록으로</a></div>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta">${escapeHtml(post.category || "일반")} · ${escapeHtml(formatKSTDate(post.publish_at || post.created_at))} · 약 ${readingTime}분 · 조회 ${Number(post.views || 0)}</div>
      <div class="actions admin-only" id="topActions">
        <button class="act-btn" onclick="copyLink()">링크 복사</button>
        <a class="act-btn" href="/admin#edit-${post.id}">수정</a>
        <button class="act-btn del" onclick="deletePost(${post.id})">삭제</button>
      </div>
      ${adTop ? `<div class="ad">${adTop}</div>` : ""}
      <article class="content">${content}</article>
${postTags.length ? `<div class="tags">${postTags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
${relatedPosts.length ? `<div class="related"><h3>관련 글</h3><div class="related-grid">${relatedPosts.map(p => `<div class="related-card"><a href="/posts/${escapeHtml(p.slug)}"><div class="related-thumb">${p.thumbnail ? `<img src="${escapeHtml(p.thumbnail)}" alt="${escapeHtml(p.title)}" width="370" height="231" loading="lazy" />` : `<div style="width:100%;height:100%"></div>`}</div><div class="related-body"><div class="r-title">${escapeHtml(p.title)}</div><div class="r-excerpt">${escapeHtml(stripHtml(p.excerpt || '').slice(0, 80))}</div><div class="r-meta">${escapeHtml(p.category || '')} · ${escapeHtml(formatKSTDate(p.publish_at || p.created_at))}</div></div></a></div>`).join("")}</div></div>` : ""}
      ${adBottom ? `<div class="ad">${adBottom}</div>` : ""}
      <hr />
      <div class="actions">
        <button class="act-btn" onclick="copyLink()">링크 복사</button>
        <a class="act-btn admin-only" href="/admin#edit-${post.id}">수정</a>
        <button class="act-btn del admin-only" onclick="deletePost(${post.id})">삭제</button>
      </div>
      <div style="margin-top:36px;padding-top:28px;border-top:1px solid var(--line)">
        <h3 style="font-size:1.05rem;font-weight:700;margin:0 0 20px">💬 댓글</h3>
        <div id="comments-list" style="margin-bottom:24px"></div>
        <div style="background:var(--bg2);border-radius:12px;padding:16px">
          <div id="reply-notice" style="display:none;font-size:.82rem;color:#2563eb;margin-bottom:8px;font-weight:600"></div>
          <input id="comment-name" placeholder="이름" maxlength="50" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;margin-bottom:8px;background:#fff;font-size:.9rem" />
          <textarea id="comment-content" placeholder="댓글을 입력하세요..." maxlength="1000" rows="3" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;resize:vertical;margin-bottom:8px;font-size:.9rem"></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button id="cancel-reply-btn" onclick="cancelReply()" style="display:none;padding:8px 14px;border:1px solid var(--line);border-radius:8px;background:#fff;cursor:pointer;font:inherit;font-size:.84rem">취소</button>
            <button onclick="submitComment()" style="padding:8px 16px;background:#111;color:#fff;border:none;border-radius:8px;cursor:pointer;font:inherit;font-weight:700;font-size:.84rem">등록</button>
          </div>
        </div>
      </div>
    </div>
  </main>
 </div>
<div class="mobile-overlay" id="mobileOverlay" onclick="closeMenu()"></div>
<div class="mobile-menu" id="mobileMenu">
  <button class="mm-close" onclick="closeMenu()">✕</button>
  <div style="clear:both;margin-bottom:16px"></div>
  ${cats.length ? `<div class="mm-section"><div class="mm-label">Categories</div>${cats.map(c => `<a href="/?cat=${encodeURIComponent(c)}" class="mm-cat">${escapeHtml(c)}</a>`).join("")}</div>` : ""}
</div>
<script>
function copyLink(){var b=document.querySelector('.act-btn');navigator.clipboard.writeText(location.href).then(function(){b.textContent='복사됨!';b.classList.add('copied');setTimeout(function(){b.textContent='링크 복사';b.classList.remove('copied')},1500)})}
async function deletePost(id){if(!confirm('이 글을 삭제하시겠습니까?'))return;var t=localStorage.getItem('admin_token');if(!t){alert('로그인이 필요합니다.');return}try{var r=await fetch('/api/posts/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+t}});var d=await r.json();if(d.success){window.location.href='/'}else{alert('삭제 실패: '+(d.error||''))}}catch(e){alert('삭제 오류: '+e.message)}}
if(localStorage.getItem('admin_token')){document.querySelectorAll('.admin-only').forEach(function(el){el.style.display=el.tagName==='DIV'?'flex':'inline-flex'})}
(function(){var hs=document.querySelectorAll('.content h2');hs.forEach(function(h,i){if(!h.id){var id='h-'+i+'-'+h.textContent.trim().replace(/\\s+/g,'-').replace(/[^a-zA-Z0-9가-힣-]/g,'').slice(0,40);h.setAttribute('id',id)}var a=document.createElement('a');a.className='heading-anchor';a.href='#'+h.id;a.textContent='#';h.insertBefore(a,h.firstChild)})})();
function openMenu(){document.getElementById('mobileMenu').classList.add('open');document.getElementById('mobileOverlay').classList.add('open')}
function closeMenu(){document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')}
(function(){var k='viewed_${post.id}',u='/api/posts/${post.id}/view',isAdmin=!!localStorage.getItem('admin_token'),opt=(!sessionStorage.getItem(k)&&!isAdmin)?{method:'POST'}:{};if(!sessionStorage.getItem(k)&&!isAdmin){sessionStorage.setItem(k,'1')}fetch(u,opt).then(function(r){return r.json()}).then(function(d){if(d.views!=null){var m=document.querySelector('.meta');if(m){m.textContent=m.textContent.replace(/조회 \\d+/,'조회 '+d.views)}}}).catch(function(){})})();
(function(){
var slug='${post.slug}';
var replyTo=null;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fmt(s){return esc(s).replace(/\\n/g,'<br>')}
var nameMap={};
function renderComments(list){
  var cont=document.getElementById('comments-list');
  if(!list||!list.length){cont.innerHTML='<p style="color:var(--muted);font-size:.88rem;padding:8px 0">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>';return;}
  var roots=list.filter(function(c){return !c.parent_id});
  var replies={};
  list.filter(function(c){return c.parent_id}).forEach(function(c){if(!replies[c.parent_id])replies[c.parent_id]=[];replies[c.parent_id].push(c);});
  roots.forEach(function(c){nameMap[c.id]=c.author_name;});
  cont.innerHTML=roots.map(function(c){
    var reps=(replies[c.id]||[]).map(function(r){
      return '<div style="margin:8px 0 0 24px;padding:10px 12px;background:#fff;border-radius:8px;border-left:3px solid #e8e8eb">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+
        '<span style="font-weight:700;font-size:.84rem">'+esc(r.author_name)+'</span>'+
        '<span style="font-size:.75rem;color:var(--muted)">'+r.created_at.slice(0,16).replace('T',' ')+'</span>'+
        (localStorage.getItem('admin_token')?'<button onclick="delComment('+r.id+')" style="margin-left:auto;background:none;border:none;color:#e53e3e;cursor:pointer;font-size:.78rem;padding:0">삭제</button>':'')+
        '</div><div style="font-size:.88rem;line-height:1.7">'+fmt(r.content)+'</div></div>';
    }).join('');
    return '<div style="padding:14px 0;border-bottom:1px solid var(--line)">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
      '<span style="font-weight:700;font-size:.88rem">'+esc(c.author_name)+'</span>'+
      '<span style="font-size:.75rem;color:var(--muted)">'+c.created_at.slice(0,16).replace('T',' ')+'</span>'+
      '<button onclick="startReply('+c.id+')" style="margin-left:auto;background:none;border:none;color:#2563eb;cursor:pointer;font-size:.8rem;font-weight:600;padding:0">답글</button>'+
      (localStorage.getItem('admin_token')?'<button onclick="delComment('+c.id+')" style="background:none;border:none;color:#e53e3e;cursor:pointer;font-size:.78rem;padding:0;margin-left:6px">삭제</button>':'')+
      '</div><div style="font-size:.9rem;line-height:1.7">'+fmt(c.content)+'</div>'+reps+'</div>';
  }).join('');
}
window.startReply=function(id){replyTo=id;var name=nameMap[id]||'';var n=document.getElementById('reply-notice');n.style.display='block';n.textContent='@'+name+' 에게 답글 작성 중';document.getElementById('cancel-reply-btn').style.display='inline-block';document.getElementById('comment-content').focus();};
window.cancelReply=function(){replyTo=null;document.getElementById('reply-notice').style.display='none';document.getElementById('cancel-reply-btn').style.display='none';};
window.submitComment=function(){
  var name=document.getElementById('comment-name').value.trim();
  var content=document.getElementById('comment-content').value.trim();
  if(!name||!content){alert('이름과 댓글을 입력하세요.');return;}
  fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:slug,author_name:name,content:content,parent_id:replyTo})})
  .then(function(r){return r.json()})
  .then(function(d){if(d.success){document.getElementById('comment-content').value='';cancelReply();loadComments();}else{alert('오류: '+(d.error||''));}})
  .catch(function(e){alert('오류: '+e.message);});
};
window.delComment=function(id){
  if(!confirm('댓글을 삭제하시겠습니까?'))return;
  var t=localStorage.getItem('admin_token');
  fetch('/api/comments/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+t}})
  .then(function(r){return r.json()})
  .then(function(d){if(d.success){loadComments();}else{alert('삭제 실패');}})
  .catch(function(e){alert('오류:'+e.message);});
};
function loadComments(){fetch('/api/comments?slug='+encodeURIComponent(slug)).then(function(r){return r.json()}).then(function(d){renderComments(d.comments||[])}).catch(function(){});}
loadComments();
})();
</script>
</body>
</html>`;
}

/* ──── 🎨 [수정 가능] 본문 중간 광고 삽입 ──────────────────────────────────────
   본문 중간에 광고를 삽입하는 위치/방식을 변경할 수 있습니다.
   ⚠️ 함수명 injectMidAd(content, adHtml) 유지 필수
   ⚠️ 반드시 HTML 문자열을 return 해야 합니다
   ────────────────────────────────────────────────────────────────────────────── */
function injectMidAd(content, adHtml) {
  if (!adHtml) return content;
  const adBlock = `<div class="ad">${adHtml}</div>`;
  const parts = String(content).split(/<\/p>/i);
  if (parts.length < 2) return content + adBlock;
  const mid = Math.floor(parts.length / 2);
  parts[mid] = parts[mid] + `</p>` + adBlock;
  return parts.join("</p>");
}

/* ──── 🎨 [수정 가능] HTML 내보내기 템플릿 ──────────────────────────────────────
   글을 HTML 파일로 내보낼 때 사용되는 템플릿입니다.
   ⚠️ 함수명 renderExportHtml(settings, post) 유지 필수
   ────────────────────────────────────────────────────────────────────────────── */
function renderExportHtml(settings, post) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(post.title)}</title><meta name="description" content="${escapeHtml(post.excerpt || '')}"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;margin:40px auto;padding:0 16px;line-height:1.8;color:#111}img{max-width:100%;height:auto;border-radius:10px}</style>${settings.adsense_code || ''}</head><body><h1>${escapeHtml(post.title)}</h1><div>${escapeHtml(formatKSTDate(post.created_at))}</div><hr><article>${post.content || ''}</article></body></html>`;
}

/* ──── 🎨 [수정 가능] 관리자 대시보드 ──────────────────────────────────────────
   관리자 페이지의 HTML, CSS, 에디터 UI를 자유롭게 변경하세요.
   ⚠️ 함수명 renderAdminPage() 유지 필수
   ⚠️ API 호출 경로(/api/...)와 인증 로직(token, authJson 등)은 변경 불가
   ⚠️ 에디터 핵심 함수명(savePost, loadPosts, editPost 등)은 변경 불가
   수정 가능한 부분:
     - CSS 스타일 (색상, 폰트, 레이아웃, 간격 등)
     - HTML 구조 (카드 배치, 버튼 위치 등)
     - 탭 이름/순서 (tabList 배열)
     - 통계 표시 형태 (loadStats 내 HTML)
     - 에디터 툴바 버튼 배치
   ────────────────────────────────────────────────────────────────────────────── */
function renderAdminPage() {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>blog-platform Admin</title>
<style>
:root{--bg:#f5f5f7;--card:#fff;--txt:#17171c;--line:#e8e8ed;--muted:#7c7c86;--pri:#111}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--txt)}
.wrap{max-width:1120px;margin:0 auto;padding:18px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.brand{font-size:1.45rem;font-weight:800;letter-spacing:-.03em}
.btn{background:#111;color:#fff;border:none;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:700;font-size:.88rem}
.btn.light{background:#fff;color:#111;border:1px solid var(--line)}
.btn:hover{opacity:.85}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}
.card h3{margin:0 0 10px;font-size:1rem}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
input,textarea,select{width:100%;border:1px solid var(--line);background:#fff;color:#111;border-radius:10px;padding:10px;font:inherit}
textarea{min-height:120px;resize:vertical}
label{font-size:.82rem;color:var(--muted);display:block;margin:8px 0 6px}
.small{font-size:.8rem;color:var(--muted)}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.tab{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;cursor:pointer;font-size:.88rem;font-weight:600}
.tab.active{background:#111;color:#fff;border-color:#111}
.hidden{display:none}
.list{max-height:600px;overflow:auto;border:1px solid var(--line);border-radius:12px}
.item{padding:10px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;align-items:center}
.item:last-child{border-bottom:none}
.item .title{font-weight:700;font-size:.95rem}
.item .meta{font-size:.76rem;color:var(--muted);margin-top:3px}
.tools{display:flex;gap:6px;flex-wrap:wrap}
.out{white-space:pre-wrap;background:#0b1020;color:#d8deff;padding:10px;border-radius:12px;min-height:70px;font-size:.82rem}
/* Editor styles */
.editor-card{padding:0;overflow:visible;position:relative}
.editor-top-sticky{position:sticky;top:0;z-index:60;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 6px 14px rgba(0,0,0,.04)}
.title-input{width:100%;border:none;border-bottom:2px solid var(--line);border-radius:0;padding:20px 20px 14px;font-size:1.8rem;font-weight:800;letter-spacing:-.03em;outline:none;background:transparent}
.title-input:focus{border-bottom-color:#111}
.title-input::placeholder{color:#c0c0c4}
.meta-row{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr;gap:8px;padding:10px 20px}
.meta-row input,.meta-row select{border-radius:8px;padding:8px 10px;font-size:.88rem}
.meta-row label{margin:0 0 4px;font-size:.78rem}
.toolbar{display:flex;flex-wrap:wrap;gap:3px;padding:8px 16px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fafafa}
.tb{background:#fff;border:1px solid #e0e0e3;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:.82rem;font-weight:600;color:#444;line-height:1}
.tb:hover{background:#eee}
.tb.on{background:#111;color:#fff;border-color:#111}
.tb-sep{width:1px;background:#ddd;margin:2px 5px;align-self:stretch}
.tb-select{height:30px;border:1px solid #e0e0e3;border-radius:7px;background:#fff;padding:0 8px;font-size:.78rem;color:#444}
.tb-color{width:34px;height:30px;border:1px solid #e0e0e3;border-radius:7px;padding:2px;background:#fff;cursor:pointer}
.editor-area{min-height:500px;padding:24px 24px 80px;background:#fff;font-size:17px;line-height:1.85;color:#111;outline:none;overflow-y:auto;word-break:break-word}
.editor-area:empty::before{content:attr(data-ph);color:#bbb;pointer-events:none}
.editor-area img{max-width:100%;height:auto;border-radius:10px;margin:12px 0;display:block}
.editor-area blockquote{border-left:3px solid #ddd;margin:12px 0;padding:8px 16px;color:#555;background:#fafafa;border-radius:0 8px 8px 0}
.editor-area h2{font-size:1.5rem;margin:24px 0 8px;letter-spacing:-.02em}
.editor-area h3{font-size:1.25rem;margin:20px 0 6px;letter-spacing:-.01em}
.editor-area a{color:#2563eb}
.editor-area hr{border:none;border-top:1px solid #e0e0e3;margin:24px 0}
.source-area{display:none;min-height:500px;padding:16px;font-family:monospace;font-size:13px;line-height:1.6;border:none;border-radius:0;resize:vertical;background:#fafcff}
.drag-over{outline:3px dashed #2563eb;outline-offset:-6px;background:#f0f4ff}
.img-uploading{padding:16px;background:#f5f5f7;border-radius:10px;color:#999;text-align:center;margin:12px 0;font-size:.9rem}
.status-bar{display:flex;justify-content:space-between;padding:8px 20px;font-size:.78rem;color:var(--muted);border-top:1px solid var(--line);background:#fafafa}
.action-bar{display:flex;gap:8px;padding:12px 20px;flex-wrap:wrap;position:sticky;bottom:0;z-index:55;background:#fff;border-top:1px solid var(--line);box-shadow:0 -6px 14px rgba(0,0,0,.04)}
.schedule-help{font-size:.72rem;color:#888;margin-top:4px}
.img-size-popup{position:absolute;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);padding:6px;display:flex;gap:4px;z-index:20}
.img-size-popup button{background:#f5f5f7;border:1px solid #e0e0e3;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.78rem;font-weight:600}
.img-size-popup button:hover{background:#111;color:#fff}
.img-popup-sep{width:1px;background:#ddd;margin:0 3px;align-self:stretch}
.img-thumb-btn{background:#eef4ff!important;border-color:#b3d1ff!important;color:#0071e3!important;font-size:.75rem!important}
.img-thumb-btn:hover{background:#0071e3!important;color:#fff!important}
.editor-area img.img-selected{outline:3px solid #2563eb;outline-offset:2px;cursor:pointer}
.thumb-row{display:flex;gap:8px;align-items:flex-end}
.thumb-row input{flex:1}
.thumb-preview{width:80px;height:56px;border-radius:8px;object-fit:cover;border:1px solid var(--line);display:none}
.thumb-preview.show{display:block}
.seo-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center}
.seo-popup{background:#fff;border-radius:18px;width:90%;max-width:560px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)}
.seo-popup-header{padding:18px 22px 12px;border-bottom:1px solid var(--line);font-size:1.1rem;font-weight:800;display:flex;justify-content:space-between;align-items:center}
.seo-popup-body{padding:16px 22px}
.seo-popup-body pre{background:#f5f5f7;padding:12px;border-radius:10px;font-size:.82rem;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto}
.seo-popup-footer{padding:12px 22px 18px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--line)}
.seo-score{font-size:2rem;font-weight:900;margin:8px 0}
.seo-score.good{color:#22c55e}.seo-score.mid{color:#eab308}.seo-score.bad{color:#e53e3e}
.seo-list{margin:8px 0;padding-left:18px;font-size:.88rem;line-height:1.7;color:#555}
/* Category management popup */
.cat-wrap{display:flex;gap:6px;align-items:flex-end}
.cat-wrap select{flex:1}
.cat-mgr-btn{background:#f5f5f7;border:1px solid #e0e0e3;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:.78rem;font-weight:700;white-space:nowrap}
.cat-mgr-btn:hover{background:#111;color:#fff}
.cat-popup-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.35);z-index:100;display:flex;align-items:center;justify-content:center}
.cat-popup{background:#fff;border-radius:16px;width:90%;max-width:420px;box-shadow:0 16px 48px rgba(0,0,0,.16)}
.cat-popup-header{padding:16px 20px 12px;border-bottom:1px solid var(--line);font-size:1rem;font-weight:800;display:flex;justify-content:space-between;align-items:center}
.cat-popup-body{padding:16px 20px;max-height:320px;overflow-y:auto}
.cat-item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f2}
.cat-item:last-child{border-bottom:none}
.cat-item input{flex:1;border:1px solid #e0e0e3;border-radius:8px;padding:6px 10px;font-size:.88rem}
.cat-item-btns{display:flex;gap:4px}
.cat-item-btns button{border:none;background:#f5f5f7;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:.76rem;font-weight:700}
.cat-item-btns button.del{color:#e53e3e}
.cat-item-btns button.del:hover{background:#e53e3e;color:#fff}
.cat-item-btns button.save{color:#2563eb}
.cat-item-btns button.save:hover{background:#2563eb;color:#fff}
.cat-popup-footer{padding:10px 20px 16px;display:flex;gap:8px;justify-content:space-between;border-top:1px solid var(--line)}
.cat-add-row{display:flex;gap:8px}
.cat-add-row input{flex:1;border:1px solid #e0e0e3;border-radius:8px;padding:6px 10px;font-size:.88rem}
@media(max-width:700px){.meta-row{grid-template-columns:1fr}.title-input{font-size:1.4rem;padding:14px 14px 10px}.toolbar{padding:6px 10px}.editor-area{padding:16px 14px 60px;font-size:15px}.action-bar{padding:10px 14px}.row{grid-template-columns:1fr}.editor-top-sticky{top:0}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div class="brand">blog-platform \uad00\ub9ac\uc790</div><div class="tools"><a href="/" class="btn light" style="text-decoration:none;display:inline-flex;align-items:center">블로그 보기</a><button class="btn light" onclick="logout()">로그아웃</button></div></div>

  <div class="card" id="loginCard">
    <h3>관리자 로그인</h3>
    <div class="row"><input id="pw" type="password" placeholder="비밀번호" onkeydown="if(event.key==='Enter')login()"><button id="loginBtn" class="btn" onclick="login()">로그인</button></div>
    <div class="small">첫 비밀번호는 워커 env ` + "`ADMIN_PASSWORD`" + ` 또는 ` + "`ADMIN_PASSWORD_HASH`" + ` 기준.</div>
  </div>

  <div id="adminApp" class="hidden">
    <div class="tabs" id="tabs"></div>

    <!-- 글쓰기 -->
    <div id="panel-editor">
      <div class="card editor-card">
        <div class="editor-top-sticky">
        <input id="title" class="title-input" placeholder="제목을 입력하세요">
        <div class="meta-row">
          <div><label>카테고리</label><div class="cat-wrap"><select id="category"><option value="">선택</option></select><button type="button" class="cat-mgr-btn" onclick="openCatPopup()">관리</button></div></div>
    <!-- 카테고리 관리 팝업 -->
    <div id="catOverlay" class="cat-popup-overlay" style="display:none" onclick="if(event.target===this)closeCatPopup()">
      <div class="cat-popup">
        <div class="cat-popup-header"><span>카테고리 관리</span><button onclick="closeCatPopup()" style="border:none;background:none;font-size:1.2rem;cursor:pointer">&times;</button></div>
        <div class="cat-popup-body" id="catList"></div>
        <div class="cat-popup-footer">
          <div class="cat-add-row"><input id="catNewInput" placeholder="새 카테고리 이름" onkeydown="if(event.key==='Enter')addCategory()"><button class="btn" onclick="addCategory()" style="padding:6px 14px;font-size:.82rem">추가</button></div>
        </div>
      </div>
    </div>
          <div><label>상태</label><select id="status" onchange="onStatusChange()"><option value="published">발행</option><option value="draft">임시저장</option><option value="scheduled">예약발행</option></select></div>
          <div><label>썸네일</label><div class="thumb-row"><input id="thumbnail" placeholder="URL 직접 입력 또는 업로드"><img id="thumbPreview" class="thumb-preview"><button type="button" class="btn light" onclick="pickThumbnail()" style="padding:6px 10px;font-size:.78rem;white-space:nowrap">업로드</button></div></div>
          <div id="publishAtWrap"><label>예약 시간</label><input id="publish_at" type="datetime-local"><div class="schedule-help">현재 기준 +50일 이내</div></div>
        </div>
        <div class="toolbar" id="toolbar">
          <button class="tb" id="tb-bold" onmousedown="event.preventDefault();fmt('bold')" title="굵게"><b>B</b></button>
          <button class="tb" id="tb-italic" onmousedown="event.preventDefault();fmt('italic')" title="기울임"><i>I</i></button>
          <button class="tb" id="tb-underline" onmousedown="event.preventDefault();fmt('underline')" title="밑줄"><u>U</u></button>
          <button class="tb" id="tb-strikethrough" onmousedown="event.preventDefault();fmt('strikethrough')" title="취소선"><s>S</s></button>
          <div class="tb-sep"></div>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'H2')" title="소제목">H2</button>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'H3')" title="소소제목">H3</button>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'P')" title="본문">P</button>
          <div class="tb-sep"></div>
          <button class="tb" id="tb-insertUnorderedList" onmousedown="event.preventDefault();fmt('insertUnorderedList')" title="점 목록">• 목록</button>
          <button class="tb" id="tb-insertOrderedList" onmousedown="event.preventDefault();fmt('insertOrderedList')" title="번호 목록">1. 목록</button>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'BLOCKQUOTE')" title="인용">인용</button>
          <div class="tb-sep"></div>
          <button class="tb" id="tb-justifyLeft" onmousedown="event.preventDefault();fmt('justifyLeft')" title="왼쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="2.5" x2="13" y2="2.5"/><line x1="1" y1="5.5" x2="9" y2="5.5"/><line x1="1" y1="8.5" x2="13" y2="8.5"/><line x1="1" y1="11.5" x2="9" y2="11.5"/></svg>
          </button>
          <button class="tb" id="tb-justifyCenter" onmousedown="event.preventDefault();fmt('justifyCenter')" title="가운데 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="2.5" x2="13" y2="2.5"/><line x1="3" y1="5.5" x2="11" y2="5.5"/><line x1="1" y1="8.5" x2="13" y2="8.5"/><line x1="3" y1="11.5" x2="11" y2="11.5"/></svg>
          </button>
          <button class="tb" id="tb-justifyRight" onmousedown="event.preventDefault();fmt('justifyRight')" title="오른쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="2.5" x2="13" y2="2.5"/><line x1="5" y1="5.5" x2="13" y2="5.5"/><line x1="1" y1="8.5" x2="13" y2="8.5"/><line x1="5" y1="11.5" x2="13" y2="11.5"/></svg>
          </button>
          <div class="tb-sep"></div>
          <button class="tb" onmousedown="event.preventDefault();fmt('insertHorizontalRule')" title="구분선">─</button>
          <button class="tb" onmousedown="event.preventDefault();insertLink()" title="링크">링크</button>
          <button class="tb" onmousedown="event.preventDefault();openImagePicker()" title="이미지 업로드">이미지 ↑</button>
          <div class="tb-sep"></div>
          <select id="fontSizePx" class="tb-select" onchange="applyFontSizePx(this.value)" title="글자 크기(px)">
            <option value="">크기(px)</option>
            <option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="18">18</option><option value="20">20</option><option value="24">24</option><option value="28">28</option><option value="32">32</option>
          </select>
          <input id="fontColorPick" class="tb-color" type="color" value="#111111" onchange="applyTextColor(this.value)" title="글자 색상">
          <button class="tb" onmousedown="event.preventDefault();clearInlineStyle()" title="글자 스타일 제거">스타일해제</button>
        </div>
        </div>
        <div id="editorArea" contenteditable="true" class="editor-area" data-ph="내용을 입력하세요..."></div>
        <textarea id="sourceArea" class="source-area" placeholder="HTML 소스를 직접 편집할 수 있습니다"></textarea>
        <div class="status-bar"><span id="charCount">0자</span><span id="autoSaveStatus">-</span></div>
        <div class="action-bar">
          <button id="saveBtn" type="button" class="btn" onclick="savePost()">저장/발행</button>
          <button class="btn light" onclick="saveDraft()">임시저장</button>
          <button class="btn light" onclick="newPost()">새 글</button>
          <button class="btn light" onclick="toggleSource()">HTML 보기</button>

          <button class="btn light" onclick="exportHtml()">내보내기</button>
          <input id="seoKeyword" placeholder="SEO 키워드" style="width:140px;padding:8px 10px;border-radius:10px;border:1px solid #e8e8ed;font-size:.85rem">
          <button class="btn light" onclick="seoAnalyzeFromEditor()">SEO 분석</button>
        </div>
      </div>
    </div>

    <!-- 글 관리 -->
    <div id="panel-manage" style="display:none">
      <div class="card">
        <h3>글 관리</h3>
        <div class="tools" style="margin-bottom:8px"><button class="btn light" onclick="loadPosts('published')">발행됨</button><button class="btn light" onclick="loadPosts('scheduled')">예약됨</button><button class="btn light" onclick="loadPosts('draft')">임시저장</button></div>
        <div class="list" id="postList"></div>
      </div>
    </div>

    <!-- 설정 -->
    <div id="panel-settings" style="display:none">
      <div class="card">
        <h3>블로그 설정</h3>
        <div class="row">
          <div><label>블로그 이름</label><input id="s_blog_name"></div>
          <div><label>블로그 설명</label><input id="s_blog_description"></div>
        </div>
        <div class="row">
          <div><label>프로필 이름</label><input id="s_profile_name"></div>
          <div><label>테마 색상</label><input id="s_theme_color" placeholder="#111111"></div>
        </div>
        <label>프로필 이미지</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="s_profile_image" placeholder="URL 직접 입력 또는 업로드">
          <img id="profileImgPreview" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:1px solid #e8e8ed;display:none">
          <button type="button" class="btn light" onclick="pickProfileImage()" style="padding:6px 12px;font-size:.78rem;white-space:nowrap">업로드</button>
        </div>
        <div class="row">
          <div><label>폰트명</label><input id="s_font_family" placeholder="Pretendard Variable"></div>
          <div><label>본문 글자크기(px)</label><input id="s_font_size_px" placeholder="18"></div>
        </div>
        <label>카테고리 목록 (쉼표 구분)</label><input id="s_categories" placeholder="일반,기술,일상,리뷰">
        <label>애드센스 코드(head/body 공용)</label><textarea id="s_adsense_code"></textarea>
        <label>상단 광고 HTML</label><textarea id="s_ad_top_html"></textarea>
        <label>중간 광고 HTML</label><textarea id="s_ad_mid_html"></textarea>
        <label>하단 광고 HTML</label><textarea id="s_ad_bottom_html"></textarea>
        <div class="row">
          <div><label>Google verification</label><input id="s_google_verification"></div>
          <div><label>Naver verification</label><input id="s_naver_verification"></div>
        </div>
        <div class="row">
          <div><label>네이버 API ID</label><input id="s_naver_client_id"></div>
          <div><label>네이버 API SECRET</label><input id="s_naver_client_secret"></div>
        </div>
        <label>IndexNow Key (글 발행 시 Bing/Yandex 자동 인덱싱)</label><input id="s_indexnow_key" placeholder="자동 생성됨">
        <div class="row">
          <div><label>자동화 API Key</label><input id="s_api_key"></div>
          <div><label>TurtleBuff API Key</label><input id="s_turtlebuff_api_key"></div>
        </div>
        <label>관리자 비밀번호 변경(6자+)</label><input id="s_admin_password" type="password" placeholder="변경 시 입력">
        <div class="tools" style="margin-top:8px"><button class="btn" onclick="saveSettings()">설정 저장</button></div>
      </div>
    </div>

    <!-- SEO -->
    <div id="panel-seo" style="display:none">
      <div class="card">
        <h3>SEO 분석/최적화</h3>
        <label>키워드</label><input id="seo_keyword" placeholder="예: 스마트스토어 마케팅">
        <div class="tools" style="margin-top:8px">
          <button class="btn light" onclick="analyzeSeo()">분석</button>
          <button class="btn" onclick="optimizeCurrent()">현재 글 자동 최적화</button>
        </div>
        <div class="small" style="margin-top:8px">네이버 API를 넣어두면 검색량 참고 결과도 같이 표시됨.</div>
        <div class="out" id="seoOut" style="margin-top:10px">ready</div>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0">
        <h3>자동화 연동 가이드</h3>
        <div class="small">외부 프로그램에서 POST /api/posts 호출 + X-API-Key 사용</div>
        <div class="out">POST /api/posts
Headers: X-API-Key: {api_key}
Body: {"title":"...","content":"&lt;p&gt;...&lt;/p&gt;","category":"...","status":"published"}</div>
      </div>
    </div>

    <!-- 통계 -->
    <div id="panel-stats" style="display:none">
      <div class="card">
        <h3>블로그 통계</h3>
        <div id="statsContent" style="margin-top:8px">
          <div style="color:#999;text-align:center;padding:20px">로딩 중...</div>
        </div>
      </div>
    </div>

    <div id="seoOverlay" class="seo-overlay" style="display:none">
      <div class="seo-popup">
        <div class="seo-popup-header"><span>SEO 분석 결과</span><button class="btn light" onclick="closeSeoPopup()" style="padding:4px 10px;font-size:.8rem">닫기</button></div>
        <div class="seo-popup-body" id="seoPopupBody"></div>
        <div class="seo-popup-footer">
          <button class="btn light" onclick="closeSeoPopup()">수동 수정</button>
          <button class="btn" onclick="applySeoOptimize()">자동 최적화 적용</button>
        </div>
      </div>
    </div>
    <section class="card" style="margin-top:14px"><h3>응답 로그</h3><div class="out" id="out">ready</div></section>
  </div>
</div>

<script>
var outEl = document.getElementById('out');
var tabList = [
  {id:'editor',label:'글쓰기'},
  {id:'manage',label:'글 관리'},
  {id:'stats',label:'통계'},
  {id:'settings',label:'설정'},
  {id:'seo',label:'SEO'}
];
var currentPostId = null;
var currentStatus = 'published';
var sourceMode = false;
var autoSaveTimer = null;
var lastSavedContent = '';

function show(d){if(outEl)outEl.textContent=typeof d==='string'?d:JSON.stringify(d,null,2)}
window.addEventListener('error',function(e){show({error:'runtime_error',message:e&&e.message?e.message:String(e)})});
window.addEventListener('unhandledrejection',function(e){show({error:'promise_rejection',message:e&&e.reason?String(e.reason):'unknown'})});
function token(){return localStorage.getItem('admin_token')||''}
function authJson(){return {'Content-Type':'application/json','Authorization':'Bearer '+token()}}
function authBearer(){return {'Authorization':'Bearer '+token()}}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}

/* === Tabs === */
function mountTabs(){
  var el=document.getElementById('tabs');
  el.innerHTML=tabList.map(function(t,i){
    return '<button class="tab '+(i===0?'active':'')+'" data-tab="'+t.id+'">'+t.label+'</button>';
  }).join('');
  el.onclick=function(e){
    var b=e.target.closest('.tab'); if(!b) return;
    switchTab(b.dataset.tab);
  };
}

function switchTab(tabId){
  document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
  var btn=document.querySelector('.tab[data-tab="'+tabId+'"]');
  if(btn) btn.classList.add('active');
  var panels=['editor','manage','stats','settings','seo'];
  panels.forEach(function(p){
    var el=document.getElementById('panel-'+p);
    if(el) el.style.display=(p===tabId)?'block':'none';
  });
  if(tabId==='stats') loadStats();
}

/* === Auth === */
async function login(){
  var pwEl=document.getElementById('pw');
  var btn=document.getElementById('loginBtn');
  var pw=(pwEl&&pwEl.value)||'';
  if(!pw.trim()){
    alert('비밀번호를 입력하세요.');
    if(pwEl) pwEl.focus();
    return;
  }
  if(btn){btn.disabled=true;btn.textContent='로그인 중...'}
  try{
    var r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    var d={};
    try{d=await r.json()}catch(_){d={error:'invalid_response'}}
    if(r.ok&&d.token){
      localStorage.setItem('admin_token',d.token);
      await initAdminApp();
    } else {
      alert('로그인 실패: '+(d.error||'비밀번호 확인 필요'));
    }
    show(d);
  } catch(e){
    var msg=String(e&&e.message?e.message:e);
    alert('로그인 요청 실패: '+msg);
    show({error:'network_error',detail:msg});
  } finally {
    if(btn){btn.disabled=false;btn.textContent='로그인'}
  }
}

async function logout(){
  await fetch('/api/auth/logout',{method:'POST',headers:authJson()});
  localStorage.removeItem('admin_token');
  location.reload();
}

/* === Editor Commands === */
function fmt(cmd,ui,val){
  document.execCommand(cmd,ui||false,val||null);
  document.getElementById('editorArea').focus();
  updateToolbarState();
}

function updateToolbarState(){
  var cmds=['bold','italic','underline','strikethrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight'];
  cmds.forEach(function(c){
    var el=document.getElementById('tb-'+c);
    if(el){
      if(document.queryCommandState(c)) el.classList.add('on');
      else el.classList.remove('on');
    }
  });
}

function insertLink(){
  var url=prompt('링크 URL을 입력하세요','https://');
  if(url) document.execCommand('createLink',false,url);
}

function applyFontSizePx(px){
  var n=parseInt(px,10);
  if(!n||n<8||n>72) return;
  document.execCommand('styleWithCSS',false,true);
  document.execCommand('fontSize',false,'7');
  var area=document.getElementById('editorArea');
  area.querySelectorAll('font[size="7"]').forEach(function(el){
    el.removeAttribute('size');
    el.style.fontSize=n+'px';
  });
  area.focus();
}

function applyTextColor(color){
  if(!color) return;
  document.execCommand('styleWithCSS',false,true);
  document.execCommand('foreColor',false,color);
  document.getElementById('editorArea').focus();
}

function clearInlineStyle(){
  document.execCommand('removeFormat',false,null);
  document.getElementById('editorArea').focus();
}

function utcToLocalStr(s){if(!s)return '';var utcStr=String(s).trim().replace(' ','T');if(utcStr.length<=19&&!utcStr.endsWith('Z'))utcStr+='Z';var d=new Date(utcStr);if(!isFinite(d.getTime()))return String(s).slice(0,16).replace('T',' ');return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}

function formatLocalDateTimeValue(input){
  if(!input) return '';
  var s=String(input).trim();
  if(!s) return '';
  var utcStr=s.replace(' ','T');
  if(utcStr.length<=19&&!utcStr.endsWith('Z'))utcStr+='Z';
  var d=new Date(utcStr);
  if(!isFinite(d.getTime())) return '';
  var y=d.getFullYear();
  var m=String(d.getMonth()+1).padStart(2,'0');
  var day=String(d.getDate()).padStart(2,'0');
  var h=String(d.getHours()).padStart(2,'0');
  var min=String(d.getMinutes()).padStart(2,'0');
  return y+'-'+m+'-'+day+'T'+h+':'+min;
}

function setPublishWindowLimits(){
  var el=document.getElementById('publish_at');
  if(!el) return;
  var now=new Date();
  now.setSeconds(0,0);
  var max=new Date(now.getTime()+50*24*60*60*1000);
  var toLocal=function(d){
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,'0');
    var day=String(d.getDate()).padStart(2,'0');
    var h=String(d.getHours()).padStart(2,'0');
    var min=String(d.getMinutes()).padStart(2,'0');
    return y+'-'+m+'-'+day+'T'+h+':'+min;
  };
  el.min=toLocal(now);
  el.max=toLocal(max);
}

function onStatusChange(){
  var st=document.getElementById('status').value;
  var wrap=document.getElementById('publishAtWrap');
  var input=document.getElementById('publish_at');
  if(!wrap||!input) return;
  if(st==='scheduled'){
    wrap.style.display='block';
    if(!input.value){
      var d=new Date(Date.now()+10*60*1000);
      d.setSeconds(0,0);
      input.value=formatLocalDateTimeValue(d.toISOString());
    }
  } else {
    wrap.style.display='none';
  }
}

function getEditorContent(){
  if(sourceMode) return document.getElementById('sourceArea').value;
  deselectImage();
  var area=document.getElementById('editorArea');
  var popups=area.querySelectorAll('.img-size-popup');
  popups.forEach(function(p){p.remove()});
  return area.innerHTML;
}

function extractBodyHtml(raw){
  var html=String(raw||'').trim();
  if(!html) return '';
  var bodyM=html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
  if(bodyM){
    html=bodyM[1].trim();
  } else if(/^<!doctype\s|^<html[\s>]/i.test(html)){
    html=html
      .replace(/^<!doctype[^>]*>/i,'')
      .replace(/<\\/?html[^>]*>/gi,'')
      .replace(/<head[\\s\\S]*?<\\/head>/gi,'')
      .replace(/<\\/?body[^>]*>/gi,'')
      .trim();
  }
  html=html.replace(/<script[\\s\\S]*?<\\/script>/gi,'');
  return html;
}

function toggleSource(){
  var area=document.getElementById('editorArea');
  var src=document.getElementById('sourceArea');
  if(!sourceMode){
    src.value=area.innerHTML;
    area.style.display='none';
    src.style.display='block';
    sourceMode=true;
  } else {
    var cleaned=extractBodyHtml(src.value);
    area.innerHTML=cleaned;
    src.value=cleaned;
    src.style.display='none';
    area.style.display='block';
    sourceMode=false;
    updateCharCount();
  }
}

function insertNodeAtCaret(node){
  var sel=window.getSelection();
  var area=document.getElementById('editorArea');
  if(!sel||!sel.rangeCount){area.appendChild(node);return}
  var range=sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* === Image Upload === */
async function uploadImage(file){
  var fd=new FormData();
  fd.append('file',file);
  var r=await fetch('/api/media/upload',{method:'POST',headers:authBearer(),body:fd});
  var d=await r.json();
  if(!d.success){show(d);return null}
  return d;
}

async function insertUploadedImage(file){
  var placeholder=document.createElement('div');
  placeholder.className='img-uploading';
  placeholder.textContent='이미지 업로드 중...';
  insertNodeAtCaret(placeholder);
  var result=await uploadImage(file);
  if(!result){
    placeholder.textContent='업로드 실패';
    setTimeout(function(){placeholder.remove()},2000);
    return;
  }
  var img=document.createElement('img');
  img.src=result.url;
  img.alt='';
  img.loading='lazy';
  placeholder.replaceWith(img);
  show('이미지 업로드 완료: '+result.key);
}

function openImagePicker(){
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.multiple=true;
  input.onchange=function(){
    for(var i=0;i<input.files.length;i++){
      insertUploadedImage(input.files[i]);
    }
  };
  input.click();
}

function pickThumbnail(){
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.onchange=async function(){
    if(!input.files.length) return;
    var result=await uploadImage(input.files[0]);
    if(result){
      document.getElementById('thumbnail').value=result.url;
      var prev=document.getElementById('thumbPreview');
      prev.src=result.url;
      prev.classList.add('show');
      show('썸네일 업로드 완료');
    }
  };
  input.click();
}

function pickProfileImage(){
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.onchange=async function(){
    if(!input.files.length) return;
    var result=await uploadImage(input.files[0]);
    if(result){
      document.getElementById('s_profile_image').value=result.url;
      var prev=document.getElementById('profileImgPreview');
      prev.src=result.url;
      prev.style.display='block';
      show('프로필 이미지 업로드 완료');
    }
  };
  input.click();
}

/* === Image Resize === */
var _imgPopup=null;
var _selectedImg=null;

function initImageResize(){
  var area=document.getElementById('editorArea');
  area.addEventListener('click',function(e){
    if(e.target.tagName==='IMG'&&area.contains(e.target)){
      selectImage(e.target);
    } else {
      deselectImage();
    }
  });
}

function selectImage(img){
  deselectImage();
  _selectedImg=img;
  img.classList.add('img-selected');
  var popup=document.createElement('div');
  popup.className='img-size-popup';
  popup.innerHTML='<button onclick="resizeImg(25)">25%</button><button onclick="resizeImg(50)">50%</button><button onclick="resizeImg(75)">75%</button><button onclick="resizeImg(100)">100%</button><span class="img-popup-sep"></span><button class="img-thumb-btn" onclick="setAsThumb()">썸네일 설정</button>';
  var rect=img.getBoundingClientRect();
  var areaRect=document.getElementById('editorArea').getBoundingClientRect();
  popup.style.top=(rect.top-areaRect.top-40)+'px';
  popup.style.left=(rect.left-areaRect.left)+'px';
  document.getElementById('editorArea').style.position='relative';
  document.getElementById('editorArea').appendChild(popup);
  _imgPopup=popup;
}

function setAsThumb(){
  if(!_selectedImg) return;
  var src=_selectedImg.src;
  document.getElementById('thumbnail').value=src;
  var prev=document.getElementById('thumbPreview');
  prev.src=src;
  prev.classList.add('show');
  show('썸네일이 설정되었습니다');
  deselectImage();
}

function deselectImage(){
  if(_selectedImg) _selectedImg.classList.remove('img-selected');
  if(_imgPopup) _imgPopup.remove();
  _selectedImg=null;
  _imgPopup=null;
}

function resizeImg(pct){
  if(!_selectedImg) return;
  _selectedImg.style.maxWidth=pct+'%';
  _selectedImg.style.width=pct+'%';
  deselectImage();
}

/* === Paste & Drop === */
function initEditorEvents(){
  var area=document.getElementById('editorArea');
  area.addEventListener('paste',function(e){
    var cb=e.clipboardData||window.clipboardData;
    if(!cb) return;
    var items=cb.items||[];
    for(var i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        e.preventDefault();
        var file=items[i].getAsFile();
        if(file) insertUploadedImage(file);
        return;
      }
    }
    /* HTML 코드를 텍스트로 붙여넣기한 경우 자동 변환 */
    var plain=(cb.getData('text/plain')||'').trim();
    var hasHtmlMime=cb.types&&cb.types.indexOf('text/html')>=0;
    if(!hasHtmlMime&&plain&&/^<(!DOCTYPE|html|head|body|div|p|h[1-6]|article|section|style|table|ul|ol)/i.test(plain)){
      e.preventDefault();
      var cleaned=plain;
      /* 전체 HTML 문서이면 body 내용만 추출 */
      var bodyM=cleaned.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
      if(bodyM) cleaned=bodyM[1].trim();
      else{
        cleaned=cleaned.replace(/^<!doctype[^>]*>/i,'').replace(/<\\/?html[^>]*>/gi,'').replace(/<head[\\s\\S]*?<\\/head>/gi,'').replace(/<\\/?body[^>]*>/gi,'');
      }
      /* script 태그 제거 (보안) */
      cleaned=cleaned.replace(/<script[\\s\\S]*?<\\/script>/gi,'');
      document.execCommand('insertHTML',false,cleaned.trim());
    }
  });
  area.addEventListener('dragover',function(e){
    e.preventDefault();
    e.dataTransfer.dropEffect='copy';
    area.classList.add('drag-over');
  });
  area.addEventListener('dragleave',function(){area.classList.remove('drag-over')});
  area.addEventListener('drop',function(e){
    e.preventDefault();
    area.classList.remove('drag-over');
    var files=e.dataTransfer.files;
    for(var i=0;i<files.length;i++){
      if(files[i].type.indexOf('image')!==-1) insertUploadedImage(files[i]);
    }
  });
  area.addEventListener('input',function(){
    updateCharCount();
    scheduleAutoSave();
  });
  document.addEventListener('selectionchange',updateToolbarState);
  initImageResize();
}

/* === Auto Save === */
function scheduleAutoSave(){
  if(autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(doAutoSave,5000);
}

async function doAutoSave(){
  var content=getEditorContent();
  var title=document.getElementById('title').value;
  if(!title&&!content) return;
  if(content===lastSavedContent) return;
  var payload={
    title:title||'(제목 없음)',
    category:document.getElementById('category').value,
    thumbnail:document.getElementById('thumbnail').value,
    content:content,
    status:'draft',
    publish_at:'',
    source:'manual'
  };
  var r;
  if(currentPostId){
    r=await fetch('/api/posts/'+currentPostId,{method:'PUT',headers:authJson(),body:JSON.stringify(payload)});
  } else {
    r=await fetch('/api/posts',{method:'POST',headers:authJson(),body:JSON.stringify(payload)});
  }
  var d=await r.json();
  if(d.post){
    currentPostId=d.post.id;
    lastSavedContent=content;
    var now=new Date();
    document.getElementById('autoSaveStatus').textContent='자동저장 '+now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  }
}

function updateCharCount(){
  var text=(document.getElementById('editorArea').innerText||'').trim();
  document.getElementById('charCount').textContent=text.length.toLocaleString()+'자';
}

/* === Posts === */
function newPost(){
  currentPostId=null;
  lastSavedContent='';
  document.getElementById('title').value='';
  document.getElementById('category').value='';
  document.getElementById('thumbnail').value='';
  document.getElementById('editorArea').innerHTML='';
  document.getElementById('sourceArea').value='';
  document.getElementById('status').value='published';
  document.getElementById('publish_at').value='';
  document.getElementById('autoSaveStatus').textContent='-';
  onStatusChange();
  updateCharCount();
  if(sourceMode) toggleSource();
}

async function savePost(){
  var btn=document.getElementById('saveBtn');
  if(btn){btn.disabled=true;btn.textContent='저장 중...'}
  try{
    var st=document.getElementById('status').value;
    var publishAtRaw=document.getElementById('publish_at').value;
    var publishAt=publishAtRaw?new Date(publishAtRaw).toISOString():'';
    var title=(document.getElementById('title').value||'').trim();
    var content=getEditorContent();
    if(!title){alert('제목을 입력하세요.');return}
    if(!String(content||'').trim()){alert('내용을 입력하세요.');return}
    if(st==='scheduled'&&!publishAt){
      alert('예약발행은 예약 시간을 입력해야 합니다.');
      return;
    }
    var payload={
      title:title,
      category:document.getElementById('category').value,
      thumbnail:document.getElementById('thumbnail').value,
      content:content,
      status:st,
      publish_at:publishAt,
      source:'manual'
    };
    var r;
    if(currentPostId){
      r=await fetch('/api/posts/'+currentPostId,{method:'PUT',headers:authJson(),body:JSON.stringify(payload)});
    } else {
      r=await fetch('/api/posts',{method:'POST',headers:authJson(),body:JSON.stringify(payload)});
    }
    var d={};
    try{d=await r.json()}catch(_){d={error:'invalid_response'}}
    if(r.status===401){
      alert('로그인이 만료되었습니다. 다시 로그인하세요.');
      localStorage.removeItem('admin_token');
      location.reload();
      return;
    }
    if(!r.ok||d.error){
      alert('저장 실패: '+(d.error||('HTTP '+r.status)));
      show(d);
      return;
    }
    if(d.post){
      currentPostId=d.post.id;
      lastSavedContent=getEditorContent();
      document.getElementById('autoSaveStatus').textContent='저장 완료';
      if(st!=='draft'){
        window.location.href='/';
        return;
      }
    }
    show(d);
    loadPosts(currentStatus);
  } catch(e){
    var msg=String(e&&e.message?e.message:e);
    alert('저장 중 오류: '+msg);
    show({error:'save_failed',detail:msg});
  } finally {
    if(btn){btn.disabled=false;btn.textContent='저장/발행'}
  }
}

async function saveDraft(){
  var prev=document.getElementById('status').value;
  document.getElementById('status').value='draft';
  onStatusChange();
  await savePost();
  document.getElementById('status').value=prev;
  onStatusChange();
}

async function exportHtml(){
  if(!currentPostId){alert('먼저 글을 저장하세요.');return}
  window.open('/api/posts/'+currentPostId+'/export','_blank');
}

async function loadPosts(status){
  currentStatus=status||currentStatus;
  var r=await fetch('/api/posts?status='+encodeURIComponent(currentStatus),{headers:authJson()});
  var d=await r.json();
  var list=document.getElementById('postList');
  if(!d.posts){list.innerHTML='<div class="item">불러오기 실패</div>';show(d);return}
  list.innerHTML=d.posts.map(function(p){
    var shownAt=utcToLocalStr(p.publish_at||p.created_at||'');
    return '<div class="item"><div><div class="title">'+esc(p.title)+'</div><div class="meta">'+
    esc(p.category||'일반')+' · '+esc(shownAt||'')+' · '+esc(p.status)+
    '</div></div><div class="tools"><button class="btn light" onclick="editPost('+p.id+')">수정</button>'+
    '<button class="btn light" onclick="removePost('+p.id+')">삭제</button></div></div>';
  }).join('')||'<div class="item">글 없음</div>';
}

async function editPost(id){
  var r=await fetch('/api/posts/'+id,{headers:authJson()});
  var d=await r.json();
  if(!d.post){show(d);return}
  currentPostId=d.post.id;
  lastSavedContent=d.post.content||'';
  document.getElementById('title').value=d.post.title||'';
  document.getElementById('category').value=d.post.category||'';
  document.getElementById('thumbnail').value=d.post.thumbnail||'';
  var prev=document.getElementById('thumbPreview');
  if(d.post.thumbnail){prev.src=d.post.thumbnail;prev.classList.add('show')}else{prev.classList.remove('show')}
  document.getElementById('editorArea').innerHTML=d.post.content||'';
  document.getElementById('status').value=d.post.status||'published';
  document.getElementById('publish_at').value=formatLocalDateTimeValue(d.post.publish_at||'');
  onStatusChange();
  if(sourceMode) toggleSource();
  updateCharCount();
  show('글 불러옴: '+id);
  switchTab('editor');
}

async function removePost(id){
  if(!confirm('삭제할까요?'))return;
  var r=await fetch('/api/posts/'+id,{method:'DELETE',headers:authJson()});
  var d=await r.json();
  if(d.success){
    if(currentPostId===id){currentPostId=null;newPost()}
    window.location.href='/';
    return;
  }
  show(d);
}

/* === Settings === */
async function loadSettings(){
  var r=await fetch('/api/settings',{headers:authJson()});
  var d=await r.json();
  if(!d.settings){show(d);return}
  Object.keys(d.settings).forEach(function(k){
    var el=document.getElementById('s_'+k);
    if(el) el.value=d.settings[k]||'';
  });
  /* 프로필 이미지 미리보기 */
  var pimg=d.settings.profile_image;
  if(pimg){var prev=document.getElementById('profileImgPreview');if(prev){prev.src=pimg;prev.style.display='block'}}
  /* 카테고리 드롭다운 채우기 */
  var cats=(d.settings.categories||'일반').split(',').map(function(c){return c.trim()}).filter(Boolean);
  window._categories=cats;
  var sel=document.getElementById('category');
  var cur=sel.value;
  sel.innerHTML='<option value="">선택</option>'+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
  if(cur) sel.value=cur;
}

/* === 카테고리 관리 팝업 === */
function openCatPopup(){
  renderCatList();
  document.getElementById('catOverlay').style.display='flex';
  document.getElementById('catNewInput').value='';
}
function closeCatPopup(){
  document.getElementById('catOverlay').style.display='none';
}
function renderCatList(){
  var cats=window._categories||[];
  var html='';
  if(cats.length===0){html='<div style="color:#999;text-align:center;padding:20px">카테고리가 없습니다. 아래에서 추가하세요.</div>'}
  else{
    cats.forEach(function(c,i){
      html+='<div class="cat-item"><input id="catEdit'+i+'" value="'+esc(c)+'"><div class="cat-item-btns"><button class="save" onclick="renameCat('+i+')">저장</button><button class="del" onclick="deleteCat('+i+')">삭제</button></div></div>';
    });
  }
  document.getElementById('catList').innerHTML=html;
}
async function saveCatsToServer(cats){
  window._categories=cats;
  var sel=document.getElementById('category');
  var cur=sel.value;
  sel.innerHTML='<option value="">선택</option>'+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
  if(cur) sel.value=cur;
  /* 설정 탭의 카테고리 필드도 동기화 */
  var scat=document.getElementById('s_categories');
  if(scat) scat.value=cats.join(',');
  /* 서버 저장 */
  await fetch('/api/settings',{method:'PUT',headers:authJson(),body:JSON.stringify({categories:cats.join(',')})});
}
async function addCategory(){
  var inp=document.getElementById('catNewInput');
  var name=inp.value.trim();
  if(!name){inp.focus();return}
  var cats=(window._categories||[]).slice();
  if(cats.indexOf(name)>=0){alert('이미 존재하는 카테고리입니다.');return}
  cats.push(name);
  await saveCatsToServer(cats);
  renderCatList();
  inp.value='';
  inp.focus();
}
async function renameCat(i){
  var inp=document.getElementById('catEdit'+i);
  var name=inp.value.trim();
  if(!name){alert('이름을 입력하세요.');inp.focus();return}
  var cats=(window._categories||[]).slice();
  if(cats[i]===name)return;
  if(cats.indexOf(name)>=0){alert('이미 존재하는 카테고리입니다.');return}
  cats[i]=name;
  await saveCatsToServer(cats);
  renderCatList();
}
async function deleteCat(i){
  var cats=(window._categories||[]).slice();
  if(!confirm('"'+cats[i]+'" 카테고리를 삭제할까요?'))return;
  cats.splice(i,1);
  await saveCatsToServer(cats);
  renderCatList();
}

async function saveSettings(){
  var payload={
    blog_name:document.getElementById('s_blog_name').value,
    blog_description:document.getElementById('s_blog_description').value,
    profile_name:document.getElementById('s_profile_name').value,
    profile_image:document.getElementById('s_profile_image').value,
    theme_color:document.getElementById('s_theme_color').value,
    font_family:document.getElementById('s_font_family').value,
    font_size_px:document.getElementById('s_font_size_px').value,
    categories:document.getElementById('s_categories').value,
    adsense_code:document.getElementById('s_adsense_code').value,
    ad_top_html:document.getElementById('s_ad_top_html').value,
    ad_mid_html:document.getElementById('s_ad_mid_html').value,
    ad_bottom_html:document.getElementById('s_ad_bottom_html').value,
    google_verification:document.getElementById('s_google_verification').value,
    naver_verification:document.getElementById('s_naver_verification').value,
    naver_client_id:document.getElementById('s_naver_client_id').value,
    naver_client_secret:document.getElementById('s_naver_client_secret').value,
    indexnow_key:document.getElementById('s_indexnow_key').value,
    api_key:document.getElementById('s_api_key').value,
    turtlebuff_api_key:document.getElementById('s_turtlebuff_api_key').value,
    admin_password:document.getElementById('s_admin_password').value
  };
  var r=await fetch('/api/settings',{method:'PUT',headers:authJson(),body:JSON.stringify(payload)});
  var d=await r.json();
  show(d);
  if(d.settings){
    document.getElementById('s_api_key').value=d.settings.api_key||'';
    document.getElementById('s_turtlebuff_api_key').value=d.settings.turtlebuff_api_key||'';
  }
}

/* === Stats === */
async function loadStats(){
  var el=document.getElementById('statsContent');
  el.innerHTML='<div style="color:#999;text-align:center;padding:20px">로딩 중...</div>';
  try{
    var r=await fetch('/api/stats',{headers:authJson()});
    var d=await r.json();
    if(!d.stats){el.innerHTML='<div style="color:#e53e3e">통계 로딩 실패</div>';return}
    var s=d.stats;
    var html='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px">';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.total_posts)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">전체 글</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.published_posts)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">발행됨</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.scheduled_posts||0)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">예약됨</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.draft_posts)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">임시저장</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.total_views).toLocaleString()+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">총 조회수</div></div>';
    html+='</div>';
    /* 인기글 TOP 10 */
    if(s.top_posts&&s.top_posts.length){
      html+='<h4 style="margin:0 0 8px;font-size:.92rem;font-weight:700">인기 글 TOP 10</h4>';
      html+='<div style="border:1px solid #e8e8ed;border-radius:12px;overflow:hidden">';
      s.top_posts.forEach(function(p,i){
        html+='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f2;font-size:.88rem">';
        html+='<div><span style="color:#86868b;font-weight:700;margin-right:8px">'+(i+1)+'</span>'+esc(p.title)+'</div>';
        html+='<div style="font-weight:700;white-space:nowrap;color:#0071e3">'+Number(p.views||0).toLocaleString()+' views</div>';
        html+='</div>';
      });
      html+='</div>';
    }
    /* 카테고리별 통계 */
    if(s.category_stats&&s.category_stats.length){
      html+='<h4 style="margin:18px 0 8px;font-size:.92rem;font-weight:700">카테고리별 현황</h4>';
      html+='<div style="border:1px solid #e8e8ed;border-radius:12px;overflow:hidden">';
      s.category_stats.forEach(function(c){
        html+='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f2;font-size:.88rem">';
        html+='<div style="font-weight:600">'+esc(c.category)+'</div>';
        html+='<div style="color:#86868b">'+c.cnt+'개 / '+Number(c.views||0).toLocaleString()+' views</div>';
        html+='</div>';
      });
      html+='</div>';
    }
    /* 최근 글 */
    if(s.recent_posts&&s.recent_posts.length){
      html+='<h4 style="margin:18px 0 8px;font-size:.92rem;font-weight:700">최근 글</h4>';
      html+='<div style="border:1px solid #e8e8ed;border-radius:12px;overflow:hidden">';
      s.recent_posts.forEach(function(p){
        var badge=p.status==='published'?'<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:600">발행</span>':'<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:600">임시</span>';
        html+='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f2;font-size:.85rem">';
        html+='<div style="display:flex;align-items:center;gap:8px">'+badge+'<span>'+esc(p.title)+'</span></div>';
        html+='<div style="color:#86868b;font-size:.78rem;white-space:nowrap">'+esc(utcToLocalStr(p.created_at||'').slice(0,10))+'</div>';
        html+='</div>';
      });
      html+='</div>';
    }
    el.innerHTML=html;
  }catch(e){
    el.innerHTML='<div style="color:#e53e3e">오류: '+esc(String(e))+'</div>';
  }
}

/* === SEO === */
async function analyzeSeo(){
  var payload={
    title:document.getElementById('title').value,
    content:getEditorContent(),
    keyword:document.getElementById('seo_keyword').value
  };
  var r=await fetch('/api/seo/analyze',{method:'POST',headers:authJson(),body:JSON.stringify(payload)});
  var d=await r.json();
  document.getElementById('seoOut').textContent=JSON.stringify(d,null,2);
}

async function optimizeCurrent(){
  if(!currentPostId){alert('수정 중인 글이 없습니다.');return}
  var keyword=document.getElementById('seo_keyword').value;
  if(!keyword){alert('키워드를 입력하세요.');return}
  var r=await fetch('/api/posts/'+currentPostId+'/optimize',{method:'POST',headers:authJson(),body:JSON.stringify({keyword:keyword})});
  var d=await r.json();
  document.getElementById('seoOut').textContent=JSON.stringify(d,null,2);
  if(d.post){
    document.getElementById('title').value=d.post.title||'';
    document.getElementById('editorArea').innerHTML=d.post.content||'';
    updateCharCount();
  }
}

/* === SEO Popup from Editor === */
var _seoKeywordCache='';

async function seoAnalyzeFromEditor(){
  var keyword=(document.getElementById('seoKeyword').value||'').trim();
  if(!keyword){alert('SEO 키워드를 입력하세요.');return}
  _seoKeywordCache=keyword;
  var title=document.getElementById('title').value;
  var content=getEditorContent();
  if(!title&&!content){alert('제목이나 내용을 먼저 입력하세요.');return}
  /* 1) 임시저장 */
  var payload={title:title||'(제목 없음)',category:document.getElementById('category').value,thumbnail:document.getElementById('thumbnail').value,content:content,status:'draft',source:'manual'};
  var sr;
  if(currentPostId){sr=await fetch('/api/posts/'+currentPostId,{method:'PUT',headers:authJson(),body:JSON.stringify(payload)})}
  else{sr=await fetch('/api/posts',{method:'POST',headers:authJson(),body:JSON.stringify(payload)})}
  var sd=await sr.json();
  if(sd.post){currentPostId=sd.post.id;lastSavedContent=content;document.getElementById('autoSaveStatus').textContent='임시저장됨'}
  /* 2) SEO 분석 */
  var r=await fetch('/api/seo/analyze',{method:'POST',headers:authJson(),body:JSON.stringify({title:title,content:content,keyword:keyword})});
  var d=await r.json();
  if(!d.success){show(d);return}
  /* 3) 팝업 표시 */
  var local=d.local||{};
  var naver=d.naver||{};
  var scoreClass=local.score>=80?'good':local.score>=50?'mid':'bad';
  var html='<div class="seo-score '+scoreClass+'">'+local.score+'/100</div>';
  html+='<div style="font-size:.88rem;color:#777;margin-bottom:12px">제목 '+local.title_length+'자 / 본문 '+local.body_length+'자 / 키워드 밀도 '+local.keyword_density_percent+'%</div>';
  if(local.suggestions&&local.suggestions.length){
    html+='<ul class="seo-list">';
    local.suggestions.forEach(function(s){html+='<li>'+esc(s)+'</li>'});
    html+='</ul>';
  } else {
    html+='<div style="color:#22c55e;font-weight:700;margin:8px 0">SEO 상태 양호!</div>';
  }
  if(naver&&naver.ok){
    html+='<div style="margin-top:12px;padding:10px;background:#f5f5f7;border-radius:10px;font-size:.85rem">';
    html+='<b>네이버 검색량:</b> '+Number(naver.result_count||0).toLocaleString()+'건';
    if(naver.sample_titles&&naver.sample_titles.length){
      html+='<div style="margin-top:6px;color:#777">상위 결과: '+naver.sample_titles.map(function(t){return esc(t)}).join(', ')+'</div>';
    }
    html+='</div>';
  }
  document.getElementById('seoPopupBody').innerHTML=html;
  document.getElementById('seoOverlay').style.display='flex';
}

function closeSeoPopup(){
  document.getElementById('seoOverlay').style.display='none';
}

function initAdminApp(){
  document.getElementById('loginCard').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  mountTabs();
  initEditorEvents();
  setPublishWindowLimits();
  onStatusChange();
  return Promise.all([loadSettings(),loadPosts('published')]).then(function(){
    var h=location.hash||'';
    if(h.indexOf('#edit-')===0){var id=parseInt(h.slice(6));if(id)editPost(id)}
    if(h.indexOf('#del-')===0){var id=parseInt(h.slice(5));if(id)removePost(id)}
  });
}

async function applySeoOptimize(){
  if(!currentPostId){alert('글이 저장되지 않았습니다.');closeSeoPopup();return}
  var keyword=_seoKeywordCache;
  if(!keyword){alert('키워드가 없습니다.');closeSeoPopup();return}
  closeSeoPopup();
  var r=await fetch('/api/posts/'+currentPostId+'/optimize',{method:'POST',headers:authJson(),body:JSON.stringify({keyword:keyword})});
  var d=await r.json();
  if(d.post){
    document.getElementById('title').value=d.post.title||'';
    document.getElementById('editorArea').innerHTML=d.post.content||'';
    lastSavedContent=d.post.content||'';
    updateCharCount();
    show('SEO 자동 최적화 적용 완료');
  } else {
    show(d);
  }
}

/* === Init === */
if(token()){
  initAdminApp();
}
</script>
</body>
</html>`;
}

/* ──── 🎨 [수정 가능] 404 페이지 ────────────────────────────────────────────────
   페이지를 찾을 수 없을 때 표시되는 404 페이지입니다.
   ⚠️ 함수명 renderNotFoundPage() 유지 필수
   ────────────────────────────────────────────────────────────────────────────── */
function renderNotFoundPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>404</title></head><body style="font-family:system-ui;padding:32px"><h1>404</h1><p>페이지를 찾을 수 없습니다.</p><a href="/">홈으로</a></body></html>`;
}