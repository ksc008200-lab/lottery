/**
 * Keyword Research Tool — Cloudflare Worker v2
 * 알파벳 전체 확장 + 질문형 + 의도 분류 기반 강력한 키워드 발굴
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/api/keywords") return handleKeywords(url);
    if (url.pathname === "/api/suggest")  return handleSuggest(url);
    return new Response(getDashboardHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  },
};

// ── 영문 확장 씨드 ──────────────────────────────────────────────────────────
const EN_ALPHA = "abcdefghijklmnopqrstuvwxyz".split("");
const EN_QUESTIONS = ["how to","how do","how can","how much","how long","how often",
  "what is","what are","what does","where to","where is","when to","when is",
  "why is","why do","which is","who is","can i","should i","do i need"];
const EN_INTENTS = ["best","top","cheap","free","easy","fastest","guide","tips",
  "for beginners","for foreigners","2025","2026","without","vs","alternative",
  "review","recommended","complete","ultimate","official"];
const EN_PREPOSITIONS = ["for","in","with","without","near","from","to","after","before","during"];

// ── 한국어 확장 씨드 ────────────────────────────────────────────────────────
const KO_INITIALS = ["가","나","다","라","마","바","사","아","자","차","카","타","파","하"];
const KO_QUESTIONS = ["방법","하는법","어떻게","무엇","언제","어디서","왜","누가",
  "어디","어떤","몇","얼마나","어느"];
const KO_INTENTS = ["추천","후기","가격","비용","종류","비교","장단점","주의사항",
  "꿀팁","준비물","신청방법","절차","조건","기간","무료","저렴","최고","입문","초보"];

// ── /api/keywords ──────────────────────────────────────────────────────────
async function handleKeywords(url) {
  const query = url.searchParams.get("q");
  if (!query) return json({ error: "q 파라미터가 필요합니다" }, 400);

  const isKorean = /[ㄱ-ㅎ가-힣]/.test(query);
  const allMap   = new Map();

  // ── 구글: 알파벳/초성 전체 확장 + 질문형 + 의도형 ──────────────────────
  const googleSeeds = buildSeeds(query, isKorean);
  const BATCH = 6; // 동시 요청 수 (rate limit 방어)
  for (let i = 0; i < googleSeeds.length; i += BATCH) {
    const batch = googleSeeds.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(seed => fetchGoogleSuggest(seed))
    );
    results.forEach(r => {
      if (r.status === "fulfilled") r.value.forEach(k => addKw(allMap, k, "google"));
    });
    if (i + BATCH < googleSeeds.length) await sleep(120);
  }

  // ── 네이버: 질문형 + 의도형 확장 ──────────────────────────────────────
  const naverSeeds = buildNaverSeeds(query, isKorean);
  const naverResults = await Promise.allSettled(naverSeeds.map(s => fetchNaverSuggest(s)));
  naverResults.forEach(r => {
    if (r.status === "fulfilled") r.value.forEach(k => addKw(allMap, k, "naver"));
  });

  // ── 다음 ──────────────────────────────────────────────────────────────
  const daumResults = await Promise.allSettled(
    [query, ...(isKorean ? KO_INTENTS.slice(0,5).map(s=>`${query} ${s}`) : EN_INTENTS.slice(0,5).map(s=>`${query} ${s}`))
    ].map(s => fetchDaumSuggest(s))
  );
  daumResults.forEach(r => {
    if (r.status === "fulfilled") r.value.forEach(k => addKw(allMap, k, "daum"));
  });

  // ── 결과 정렬 + 의도 분류 ─────────────────────────────────────────────
  const results = [...allMap.values()]
    .filter(item => item.keyword.toLowerCase() !== query.toLowerCase())
    .map(item => ({
      ...item,
      intent: classifyIntent(item.keyword),
      potential: calcPotential(item, isKorean),
    }))
    .sort((a, b) => b.score - a.score);

  const googleTotal = [...allMap.values()].filter(i => i.sources.includes("google")).length;
  const naverTotal  = [...allMap.values()].filter(i => i.sources.includes("naver")).length;
  const daumTotal   = [...allMap.values()].filter(i => i.sources.includes("daum")).length;

  return json({
    query,
    total: results.length,
    summary: {
      google: googleTotal,
      naver: naverTotal,
      daum: daumTotal,
      multiSource: results.filter(r => r.multiSource).length,
      longTail:    results.filter(r => r.isLongTail).length,
      high:        results.filter(r => r.potential === "HIGH").length,
    },
    keywords: results,
  });
}

// ── /api/suggest ─────────────────────────────────────────────────────────
async function handleSuggest(url) {
  const query  = url.searchParams.get("q");
  const source = url.searchParams.get("source") || "google";
  if (!query) return json({ error: "q 파라미터가 필요합니다" }, 400);
  let results = [];
  if (source === "google") results = await fetchGoogleSuggest(query);
  else if (source === "naver") results = await fetchNaverSuggest(query);
  else if (source === "daum")  results = await fetchDaumSuggest(query);
  return json({ query, source, results });
}

// ── 씨드 빌더 ─────────────────────────────────────────────────────────────
function buildSeeds(query, isKorean) {
  const seeds = [query];
  if (isKorean) {
    // 초성 확장
    KO_INITIALS.forEach(c  => seeds.push(`${query} ${c}`));
    // 질문형
    KO_QUESTIONS.forEach(q => seeds.push(`${query} ${q}`));
    // 의도형
    KO_INTENTS.forEach(i   => seeds.push(`${query} ${i}`));
  } else {
    // 알파벳 A-Z 앞에 붙이기 (Ubersuggest 방식)
    EN_ALPHA.forEach(c     => seeds.push(`${query} ${c}`));
    // 질문형 앞에 붙이기
    EN_QUESTIONS.forEach(q => seeds.push(`${q} ${query}`));
    // 의도형 뒤에 붙이기
    EN_INTENTS.forEach(i   => seeds.push(`${query} ${i}`));
    // 전치사 확장
    EN_PREPOSITIONS.forEach(p => seeds.push(`${query} ${p}`));
  }
  return seeds;
}

function buildNaverSeeds(query, isKorean) {
  const seeds = [query];
  if (isKorean) {
    KO_QUESTIONS.slice(0,8).forEach(q => seeds.push(`${query} ${q}`));
    KO_INTENTS.slice(0,8).forEach(i   => seeds.push(`${query} ${i}`));
  } else {
    EN_QUESTIONS.slice(0,6).forEach(q => seeds.push(`${q} ${query}`));
    EN_INTENTS.slice(0,6).forEach(i   => seeds.push(`${query} ${i}`));
  }
  return seeds;
}

// ── 구글 자동완성 ─────────────────────────────────────────────────────────
async function fetchGoogleSuggest(query) {
  try {
    const hl = /[ㄱ-ㅎ가-힣]/.test(query) ? "ko" : "en";
    const u  = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&q=${encodeURIComponent(query)}`;
    const res = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cf: { cacheTtl: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data[1] || []).slice(0, 10);
  } catch { return []; }
}

// ── 네이버 자동완성 ───────────────────────────────────────────────────────
async function fetchNaverSuggest(query) {
  try {
    const u = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(query)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&q_enc=UTF-8&st=100&_callback=`;
    const res = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.naver.com" },
      cf: { cacheTtl: 1800 },
    });
    if (!res.ok) return [];
    const data = JSON.parse(await res.text());
    return (data?.items?.[0] || []).map(i => Array.isArray(i) ? i[0] : i).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

// ── 다음 자동완성 ─────────────────────────────────────────────────────────
async function fetchDaumSuggest(query) {
  try {
    const u = `https://suggest-bar.daum.net/suggest?q=${encodeURIComponent(query)}&mod=json&code=utf_in_euc_out&output=json`;
    const res = await fetch(u, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.daum.net" },
      cf: { cacheTtl: 1800 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items || []).map(i => i?.query || i).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

// ── 의도 분류 ──────────────────────────────────────────────────────────────
function classifyIntent(kw) {
  const k = kw.toLowerCase();
  if (isKorean) {
    if (/구매|가격|비용|얼마|최저가|할인|무료/.test(k)) return "💰 구매/비용";
    if (/방법|하는법|어떻게|신청|절차|순서/.test(k))    return "📖 방법/가이드";
    if (/후기|리뷰|평점|추천|비교|장단점/.test(k))       return "⭐ 후기/비교";
    if (/초보|입문|처음|기초|기본|쉬운/.test(k))          return "🌱 입문/초보";
    if (/오류|안됨|문제|해결|안되는/.test(k))             return "🔧 문제해결";
    return "📌 정보";
  } else {
    if (/buy|price|cost|cheap|free|discount|best/.test(k)) return "💰 Commercial";
    if (/how to|guide|tutorial|step|learn/.test(k))        return "📖 How-to";
    if (/review|vs|compare|difference|alternative/.test(k))return "⭐ Comparison";
    if (/beginner|start|basics|intro|first/.test(k))       return "🌱 Beginner";
    if (/error|problem|fix|not working|issue/.test(k))     return "🔧 Troubleshoot";
    return "📌 Informational";
  }
}

// ── 잠재력 점수 ────────────────────────────────────────────────────────────
function calcPotential(item, isKorean) {
  let s = item.score;
  if (item.multiSource)     s += 6;
  if (item.isLongTail)      s += 3;
  if (item.wordCount >= 4)  s += 3;
  if (item.wordCount >= 5)  s += 2;
  // 구매/방법 의도는 트래픽 + 수익성 모두 높음
  const k = item.keyword.toLowerCase();
  if (/how to|guide|best|tips|tutorial/.test(k))          s += 4;
  if (/방법|추천|가이드|후기|비교|하는법/.test(k))           s += 4;
  if (/2025|2026/.test(k))                                 s += 2;
  if (/for beginners|for foreigners|초보|입문/.test(k))    s += 3;
  return s >= 14 ? "HIGH" : s >= 8 ? "MED" : "LOW";
}

// ── 유틸 ──────────────────────────────────────────────────────────────────
function addKw(map, kw, source) {
  if (!kw || kw.trim().length < 2) return;
  const key = kw.trim().toLowerCase();
  if (map.has(key)) {
    const entry = map.get(key);
    if (!entry.sources.includes(source)) {
      entry.sources.push(source);
      entry.score += sourceScore(source);
      entry.multiSource = entry.sources.length > 1;
    }
  } else {
    map.set(key, {
      keyword:     kw.trim(),
      sources:     [source],
      score:       sourceScore(source),
      wordCount:   kw.trim().split(/\s+/).length,
      multiSource: false,
      isLongTail:  kw.trim().split(/\s+/).length >= 3,
    });
  }
}

function sourceScore(source) {
  return source === "google" ? 3 : source === "naver" ? 2 : 1;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json;charset=UTF-8" },
  });
}

// ── 대시보드 HTML ──────────────────────────────────────────────────────────
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>키워드 리서치 툴 v2</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.header{background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:1px solid rgba(255,255,255,.08);padding:20px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.header h1{font-size:1.4rem;font-weight:800;color:#fff}
.header h1 span{color:#e8a020}
.header-sub{font-size:.8rem;color:#64748b;margin-top:3px}
.version{font-size:.72rem;background:rgba(232,160,32,.15);border:1px solid rgba(232,160,32,.3);color:#e8a020;padding:3px 10px;border-radius:100px;font-weight:700}
.main{max-width:1280px;margin:0 auto;padding:28px 24px}
.search-box{background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px 28px;margin-bottom:28px}
.search-row{display:flex;gap:10px;flex-wrap:wrap}
.search-input{flex:1;min-width:280px;background:#0f172a;border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:13px 18px;font-size:1rem;color:#fff;outline:none;transition:border-color .2s}
.search-input:focus{border-color:#e8a020}
.search-input::placeholder{color:#475569}
.search-btn{background:#e8a020;color:#0f172a;font-size:.97rem;font-weight:700;padding:13px 26px;border-radius:10px;border:none;cursor:pointer;transition:background .2s,transform .18s;white-space:nowrap}
.search-btn:hover{background:#f0b030;transform:translateY(-1px)}
.search-btn:disabled{background:#334155;color:#64748b;cursor:not-allowed;transform:none}
.search-info{font-size:.78rem;color:#475569;margin-top:10px}
.search-info strong{color:#94a3b8}
.sources{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.sb{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:7px;padding:5px 12px;font-size:.78rem;color:#94a3b8}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dg{background:#4285f4}.dn{background:#03c75a}.dd{background:#ff5722}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:14px;margin-bottom:24px}
.sc{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px;text-align:center}
.sn{font-size:1.9rem;font-weight:800;color:#e8a020;line-height:1}
.sl{font-size:.72rem;color:#64748b;margin-top:5px;letter-spacing:.06em;text-transform:uppercase}
.sc.high .sn{color:#4ade80}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.filter-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);color:#94a3b8;padding:6px 14px;border-radius:7px;font-size:.8rem;cursor:pointer;transition:.18s;white-space:nowrap}
.filter-btn.on,.filter-btn:hover{background:rgba(232,160,32,.1);border-color:rgba(232,160,32,.35);color:#e8a020}
.sort-label{font-size:.78rem;color:#475569;margin-left:auto;margin-right:4px}
.export-btn{background:rgba(79,70,229,.12);border:1px solid rgba(79,70,229,.28);color:#818cf8;padding:6px 14px;border-radius:7px;font-size:.8rem;font-weight:700;cursor:pointer;transition:.18s;white-space:nowrap}
.export-btn:hover{background:rgba(79,70,229,.22)}
.kw-table{width:100%;border-collapse:collapse}
.kw-table th{text-align:left;font-size:.72rem;font-weight:700;color:#475569;letter-spacing:.08em;text-transform:uppercase;padding:8px 14px;border-bottom:1px solid rgba(255,255,255,.07)}
.kw-row{border-bottom:1px solid rgba(255,255,255,.05);transition:background .15s}
.kw-row:hover{background:rgba(255,255,255,.03)}
.kw-row td{padding:11px 14px;vertical-align:middle}
.kw-text{font-size:.93rem;color:#e2e8f0;font-weight:500}
.kw-badges{display:flex;gap:5px;flex-wrap:wrap}
.badge{font-size:.67rem;font-weight:700;padding:2px 7px;border-radius:5px;letter-spacing:.03em;white-space:nowrap}
.bg{background:rgba(66,133,244,.13);color:#4285f4;border:1px solid rgba(66,133,244,.28)}
.bn{background:rgba(3,199,90,.1);color:#03c75a;border:1px solid rgba(3,199,90,.28)}
.bd{background:rgba(255,87,34,.1);color:#ff7043;border:1px solid rgba(255,87,34,.28)}
.bl{background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.28)}
.bm{background:rgba(232,160,32,.1);color:#e8a020;border:1px solid rgba(232,160,32,.28)}
.intent{font-size:.78rem;color:#94a3b8;white-space:nowrap}
.pot{font-size:.72rem;font-weight:800;padding:3px 9px;border-radius:5px;letter-spacing:.05em;white-space:nowrap}
.pH{background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.28)}
.pM{background:rgba(234,179,8,.1);color:#facc15;border:1px solid rgba(234,179,8,.28)}
.pL{background:rgba(100,116,139,.1);color:#64748b;border:1px solid rgba(100,116,139,.2)}
.copy-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#475569;padding:4px 9px;border-radius:5px;font-size:.72rem;cursor:pointer;transition:.15s;white-space:nowrap}
.copy-btn:hover{background:rgba(232,160,32,.1);border-color:rgba(232,160,32,.3);color:#e8a020}
.loading{text-align:center;padding:60px 24px;color:#475569}
.spin{width:36px;height:36px;border:3px solid rgba(255,255,255,.08);border-top-color:#e8a020;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 14px}
.loading-detail{font-size:.82rem;color:#334155;margin-top:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:60px 24px;color:#475569}
@media(max-width:640px){.header{padding:14px 16px}.main{padding:16px 12px}.search-row{flex-direction:column}.kw-table th:nth-child(3),.kw-row td:nth-child(3){display:none}}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>🔍 키워드 <span>리서치</span> 툴</h1>
    <div class="header-sub">Google A-Z 확장 · Naver · Daum — 실전 키워드 발굴</div>
  </div>
  <span class="version">v2.0 POWER</span>
</div>

<div class="main">
  <div class="search-box">
    <div class="search-row">
      <input class="search-input" id="qi" type="text"
        placeholder="키워드 입력 (예: korea travel, 한국 여행, learn korean)" />
      <button class="search-btn" id="sb" onclick="search()">🔍 키워드 발굴</button>
    </div>
    <div class="search-info">
      영문: <strong>A-Z 알파벳 확장 + 질문형 + 의도형</strong> 조합 |
      한글: <strong>초성 확장 + 방법/추천/후기</strong> 조합 — 최대 300개+ 키워드 수집
    </div>
    <div class="sources">
      <div class="sb"><span class="dot dg"></span>Google 자동완성</div>
      <div class="sb"><span class="dot dn"></span>Naver 자동완성</div>
      <div class="sb"><span class="dot dd"></span>Daum 자동완성</div>
    </div>
  </div>
  <div id="results"></div>
</div>

<script>
let all = [];

async function search() {
  const q = document.getElementById('qi').value.trim();
  if (!q) { alert('키워드를 입력하세요'); return; }
  const btn = document.getElementById('sb');
  btn.disabled = true; btn.textContent = '⏳ 수집 중...';
  document.getElementById('results').innerHTML =
    '<div class="loading"><div class="spin"></div><div>Google A-Z 확장 + Naver + Daum 수집 중...</div><div class="loading-detail">알파벳/초성 전체 조합 중 — 최대 20초 소요됩니다</div></div>';
  try {
    const res  = await fetch('/api/keywords?q=' + encodeURIComponent(q));
    const data = await res.json();
    all = data.keywords || [];
    render(data);
  } catch(e) {
    document.getElementById('results').innerHTML = '<div class="empty">❌ 오류 발생. 다시 시도해주세요.</div>';
  }
  btn.disabled = false; btn.textContent = '🔍 키워드 발굴';
}

function render(data) {
  if (!all.length) { document.getElementById('results').innerHTML = '<div class="empty">결과 없음</div>'; return; }
  document.getElementById('results').innerHTML =
    sumHTML(data) + toolbarHTML() + tableHTML(all);
}

function sumHTML(d) {
  return \`<div class="summary">
    <div class="sc"><div class="sn">\${d.total}</div><div class="sl">총 키워드</div></div>
    <div class="sc high"><div class="sn">\${d.summary.high}</div><div class="sl">HIGH 잠재력</div></div>
    <div class="sc"><div class="sn">\${d.summary.google}</div><div class="sl">Google</div></div>
    <div class="sc"><div class="sn">\${d.summary.naver}</div><div class="sl">Naver</div></div>
    <div class="sc"><div class="sn">\${d.summary.daum}</div><div class="sl">Daum</div></div>
    <div class="sc"><div class="sn">\${d.summary.multiSource}</div><div class="sl">복수 소스</div></div>
    <div class="sc"><div class="sn">\${d.summary.longTail}</div><div class="sl">롱테일</div></div>
  </div>\`;
}

function toolbarHTML() {
  return \`<div class="toolbar">
    <button class="filter-btn on" onclick="filt('all',this)">전체</button>
    <button class="filter-btn" onclick="filt('HIGH',this)">🟢 HIGH</button>
    <button class="filter-btn" onclick="filt('MED',this)">🟡 MED</button>
    <button class="filter-btn" onclick="filt('multi',this)">복수소스</button>
    <button class="filter-btn" onclick="filt('longtail',this)">롱테일</button>
    <button class="filter-btn" onclick="filt('google',this)">Google만</button>
    <button class="filter-btn" onclick="filt('naver',this)">Naver만</button>
    <button class="filter-btn" onclick="filt('daum',this)">Daum만</button>
    <span class="sort-label">내보내기:</span>
    <button class="export-btn" onclick="csv()">📥 CSV</button>
    <button class="export-btn" onclick="copyHigh()">⭐ HIGH 복사</button>
  </div>\`;
}

function tableHTML(kws) {
  return \`<table class="kw-table">
    <thead><tr>
      <th>#</th><th>키워드</th><th>의도</th><th>소스</th><th>잠재력</th><th>복사</th>
    </tr></thead>
    <tbody>\${kws.map((k,i) => rowHTML(k, i+1)).join('')}</tbody>
  </table>\`;
}

function rowHTML(k, i) {
  const badges = [
    k.sources.includes('google') ? '<span class="badge bg">G</span>' : '',
    k.sources.includes('naver')  ? '<span class="badge bn">N</span>' : '',
    k.sources.includes('daum')   ? '<span class="badge bd">D</span>' : '',
    k.isLongTail  ? '<span class="badge bl">롱테일</span>' : '',
    k.multiSource ? '<span class="badge bm">복수</span>'  : '',
  ].filter(Boolean).join('');
  const pc = k.potential === 'HIGH' ? 'pH' : k.potential === 'MED' ? 'pM' : 'pL';
  return \`<tr class="kw-row">
    <td style="color:#334155;font-size:.78rem">\${i}</td>
    <td class="kw-text">\${esc(k.keyword)}</td>
    <td class="intent">\${k.intent||''}</td>
    <td><div class="kw-badges">\${badges}</div></td>
    <td><span class="pot \${pc}">\${k.potential}</span></td>
    <td><button class="copy-btn" onclick="cp('\${esc(k.keyword)}',this)">복사</button></td>
  </tr>\`;
}

function filt(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  let f = all;
  if (type==='HIGH')     f = all.filter(k=>k.potential==='HIGH');
  else if(type==='MED')  f = all.filter(k=>k.potential==='MED');
  else if(type==='multi')   f = all.filter(k=>k.multiSource);
  else if(type==='longtail')f = all.filter(k=>k.isLongTail);
  else if(type==='google')  f = all.filter(k=>k.sources.includes('google'));
  else if(type==='naver')   f = all.filter(k=>k.sources.includes('naver'));
  else if(type==='daum')    f = all.filter(k=>k.sources.includes('daum'));
  document.querySelector('.kw-table tbody').innerHTML = f.map((k,i)=>rowHTML(k,i+1)).join('');
}

function cp(text, btn) {
  navigator.clipboard.writeText(text).then(()=>{ btn.textContent='✓'; setTimeout(()=>btn.textContent='복사',1500); });
}
function copyHigh() {
  const h = all.filter(k=>k.potential==='HIGH').map(k=>k.keyword).join('\\n');
  navigator.clipboard.writeText(h).then(()=>alert('HIGH 키워드 '+all.filter(k=>k.potential==='HIGH').length+'개 복사!'));
}
function csv() {
  const rows=[['키워드','소스','의도','잠재력','롱테일','복수소스']];
  all.forEach(k=>rows.push([k.keyword, k.sources.join('+'), k.intent||'', k.potential, k.isLongTail?'Y':'N', k.multiSource?'Y':'N']));
  const c = rows.map(r=>r.map(v=>\`"\${v}"\`).join(',')).join('\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\\uFEFF'+c],{type:'text/csv;charset=utf-8'}));
  a.download='keywords.csv'; a.click();
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
document.getElementById('qi').addEventListener('keydown', e=>{ if(e.key==='Enter') search(); });
</script>
</body>
</html>`;
}
