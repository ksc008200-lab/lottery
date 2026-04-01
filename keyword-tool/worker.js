/**
 * Keyword Research Tool — Cloudflare Worker
 * 구글 / 네이버 / 다음 자동완성 기반 키워드 발굴 엔진
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── 라우팅 ──
    if (url.pathname === "/api/keywords") {
      return handleKeywords(url);
    }

    if (url.pathname === "/api/suggest") {
      return handleSuggest(url);
    }

    // 대시보드 HTML 서빙
    return new Response(getDashboardHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};

// ── /api/keywords — 전체 키워드 발굴 (구글 + 네이버 + 다음) ──────────────────
async function handleKeywords(url) {
  const query = url.searchParams.get("q");
  if (!query) {
    return json({ error: "q 파라미터가 필요합니다" }, 400);
  }

  const [google, naver, daum] = await Promise.allSettled([
    fetchGoogleSuggest(query),
    fetchNaverSuggest(query),
    fetchDaumSuggest(query),
  ]);

  const googleKw  = google.status  === "fulfilled" ? google.value  : [];
  const naverKw   = naver.status   === "fulfilled" ? naver.value   : [];
  const daumKw    = daum.status    === "fulfilled" ? daum.value    : [];

  // 중복 제거 + 점수 계산
  const allMap = new Map();

  const addKw = (kw, source) => {
    if (!kw || kw.trim().length < 2) return;
    const key = kw.trim().toLowerCase();
    if (allMap.has(key)) {
      allMap.get(key).sources.push(source);
      allMap.get(key).score += sourceScore(source);
    } else {
      allMap.set(key, {
        keyword: kw.trim(),
        sources: [source],
        score: sourceScore(source),
        wordCount: kw.trim().split(/\s+/).length,
      });
    }
  };

  googleKw.forEach(k => addKw(k, "google"));
  naverKw.forEach(k  => addKw(k, "naver"));
  daumKw.forEach(k   => addKw(k, "daum"));

  // 점수 정렬 + 메타 정보 추가
  const results = [...allMap.values()]
    .map(item => ({
      ...item,
      multiSource: item.sources.length > 1,
      isLongTail: item.wordCount >= 3,
      potential: calcPotential(item),
    }))
    .sort((a, b) => b.score - a.score);

  return json({
    query,
    total: results.length,
    summary: {
      google: googleKw.length,
      naver: naverKw.length,
      daum: daumKw.length,
      multiSource: results.filter(r => r.multiSource).length,
      longTail: results.filter(r => r.isLongTail).length,
    },
    keywords: results,
  });
}

// ── /api/suggest — 단일 소스 자동완성 ───────────────────────────────────────
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

// ── 구글 자동완성 ─────────────────────────────────────────────────────────────
async function fetchGoogleSuggest(query) {
  try {
    // 알파벳 확장: a~z + 숫자 조합으로 더 많은 키워드 수집
    const seeds = ["", ...generateSeeds(query)];
    const all = new Set();

    await Promise.allSettled(
      seeds.slice(0, 8).map(async seed => {
        const q = seed ? `${query} ${seed}` : query;
        const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0" },
          cf: { cacheTtl: 3600 },
        });
        if (!res.ok) return;
        const data = await res.json();
        const suggestions = data[1] || [];
        suggestions.forEach(s => all.add(s));
      })
    );

    return [...all].slice(0, 40);
  } catch {
    return [];
  }
}

// ── 네이버 자동완성 ───────────────────────────────────────────────────────────
async function fetchNaverSuggest(query) {
  try {
    const url = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(query)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&q_enc=UTF-8&st=100&_callback=`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.naver.com" },
      cf: { cacheTtl: 3600 },
    });
    if (!res.ok) return [];
    const text = await res.text();
    const data = JSON.parse(text);
    const items = data?.items?.[0] || [];
    return items.map(item => (Array.isArray(item) ? item[0] : item)).filter(Boolean).slice(0, 30);
  } catch {
    return [];
  }
}

// ── 다음 자동완성 ─────────────────────────────────────────────────────────────
async function fetchDaumSuggest(query) {
  try {
    const url = `https://suggest-bar.daum.net/suggest?q=${encodeURIComponent(query)}&mod=json&code=utf_in_euc_out&output=json`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.daum.net" },
      cf: { cacheTtl: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items || []).map(item => item?.query || item).filter(Boolean).slice(0, 30);
  } catch {
    return [];
  }
}

// ── 유틸리티 ──────────────────────────────────────────────────────────────────

function generateSeeds(query) {
  // 영문이면 알파벳, 한글이면 한글 초성
  const isKorean = /[ㄱ-ㅎ가-힣]/.test(query);
  if (isKorean) {
    return ["방법", "추천", "가격", "후기", "종류", "비교", "장단점", "입문"];
  }
  return ["how", "what", "best", "top", "guide", "for beginners", "tips", "vs"];
}

function sourceScore(source) {
  return source === "google" ? 3 : source === "naver" ? 2 : 1;
}

function calcPotential(item) {
  let score = item.score;
  if (item.multiSource) score += 5;       // 여러 소스에서 등장
  if (item.isLongTail)  score += 3;       // 롱테일 키워드
  if (item.wordCount >= 4) score += 2;    // 4단어 이상 매우 구체적
  if (/how|guide|best|tips/.test(item.keyword.toLowerCase())) score += 2; // 정보성
  if (/방법|추천|후기|가이드|비교/.test(item.keyword)) score += 2; // 한국어 정보성
  return score >= 10 ? "HIGH" : score >= 6 ? "MED" : "LOW";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "Content-Type": "application/json;charset=UTF-8" },
  });
}

// ── 대시보드 HTML ─────────────────────────────────────────────────────────────
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>키워드 리서치 툴</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.header{background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:1px solid rgba(255,255,255,.08);padding:24px 32px;display:flex;align-items:center;gap:16px}
.header h1{font-size:1.5rem;font-weight:800;color:#fff;letter-spacing:-.02em}
.header h1 span{color:#e8a020}
.header-sub{font-size:.85rem;color:#64748b;margin-top:4px}
.main{max-width:1200px;margin:0 auto;padding:32px 24px}
.search-box{background:#1e293b;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:28px 32px;margin-bottom:32px}
.search-row{display:flex;gap:12px;flex-wrap:wrap}
.search-input{flex:1;min-width:280px;background:#0f172a;border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:14px 20px;font-size:1rem;color:#fff;outline:none;transition:border-color .2s}
.search-input:focus{border-color:#e8a020}
.search-input::placeholder{color:#475569}
.search-btn{background:#e8a020;color:#0f172a;font-size:.97rem;font-weight:700;padding:14px 28px;border-radius:10px;border:none;cursor:pointer;transition:background .2s,transform .18s;white-space:nowrap}
.search-btn:hover{background:#f0b030;transform:translateY(-1px)}
.search-btn:disabled{background:#475569;cursor:not-allowed;transform:none}
.sources{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
.source-badge{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 14px;font-size:.82rem;color:#94a3b8}
.source-badge.active{border-color:#e8a020;color:#e8a020;background:rgba(232,160,32,.08)}
.dot{width:8px;height:8px;border-radius:50%}
.dot-google{background:#4285f4}
.dot-naver{background:#03c75a}
.dot-daum{background:#ff5722}
.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:28px}
.sum-card{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;text-align:center}
.sum-num{font-size:2rem;font-weight:800;color:#e8a020;line-height:1}
.sum-label{font-size:.78rem;color:#64748b;margin-top:6px;letter-spacing:.05em;text-transform:uppercase}
.filters{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.filter-btn{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#94a3b8;padding:7px 16px;border-radius:8px;font-size:.83rem;cursor:pointer;transition:.2s}
.filter-btn.active,.filter-btn:hover{background:rgba(232,160,32,.12);border-color:rgba(232,160,32,.4);color:#e8a020}
.results{display:flex;flex-direction:column;gap:8px}
.kw-row{background:#1e293b;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:14px;transition:background .2s,border-color .2s}
.kw-row:hover{background:#243044;border-color:rgba(232,160,32,.25)}
.kw-text{flex:1;font-size:.95rem;color:#e2e8f0;font-weight:500}
.kw-badges{display:flex;gap:6px;flex-wrap:wrap}
.badge{font-size:.7rem;font-weight:700;padding:3px 8px;border-radius:6px;letter-spacing:.04em}
.badge-google{background:rgba(66,133,244,.15);color:#4285f4;border:1px solid rgba(66,133,244,.3)}
.badge-naver{background:rgba(3,199,90,.12);color:#03c75a;border:1px solid rgba(3,199,90,.3)}
.badge-daum{background:rgba(255,87,34,.12);color:#ff7043;border:1px solid rgba(255,87,34,.3)}
.badge-longtail{background:rgba(139,92,246,.12);color:#a78bfa;border:1px solid rgba(139,92,246,.3)}
.badge-multi{background:rgba(232,160,32,.12);color:#e8a020;border:1px solid rgba(232,160,32,.3)}
.potential{font-size:.75rem;font-weight:800;padding:4px 10px;border-radius:6px;letter-spacing:.06em}
.pot-HIGH{background:rgba(34,197,94,.15);color:#4ade80;border:1px solid rgba(34,197,94,.3)}
.pot-MED{background:rgba(234,179,8,.12);color:#facc15;border:1px solid rgba(234,179,8,.3)}
.pot-LOW{background:rgba(100,116,139,.12);color:#94a3b8;border:1px solid rgba(100,116,139,.3)}
.copy-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#64748b;padding:5px 10px;border-radius:6px;font-size:.75rem;cursor:pointer;transition:.2s;white-space:nowrap}
.copy-btn:hover{background:rgba(232,160,32,.1);border-color:rgba(232,160,32,.3);color:#e8a020}
.loading{text-align:center;padding:60px 24px;color:#475569}
.loading-spinner{width:40px;height:40px;border:3px solid rgba(255,255,255,.1);border-top-color:#e8a020;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
.empty{text-align:center;padding:60px 24px;color:#475569;font-size:.95rem}
.export-bar{display:flex;gap:10px;justify-content:flex-end;margin-bottom:16px}
.export-btn{background:rgba(79,70,229,.15);border:1px solid rgba(79,70,229,.3);color:#818cf8;padding:8px 18px;border-radius:8px;font-size:.83rem;font-weight:700;cursor:pointer;transition:.2s}
.export-btn:hover{background:rgba(79,70,229,.25)}
@media(max-width:640px){.header{padding:16px 20px}.main{padding:20px 16px}.search-row{flex-direction:column}.kw-row{flex-wrap:wrap}}
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>🔍 키워드 <span>리서치</span> 툴</h1>
    <div class="header-sub">Google · Naver · Daum 자동완성 기반 키워드 발굴</div>
  </div>
</div>

<div class="main">

  <!-- 검색창 -->
  <div class="search-box">
    <div class="search-row">
      <input class="search-input" id="queryInput" type="text" placeholder="키워드 입력 (예: 한국 여행, korea travel, 서울 맛집)" />
      <button class="search-btn" id="searchBtn" onclick="search()">🔍 키워드 발굴</button>
    </div>
    <div class="sources">
      <div class="source-badge active"><span class="dot dot-google"></span>Google 자동완성</div>
      <div class="source-badge active"><span class="dot dot-naver"></span>Naver 자동완성</div>
      <div class="source-badge active"><span class="dot dot-daum"></span>Daum 자동완성</div>
    </div>
  </div>

  <!-- 결과 영역 -->
  <div id="results"></div>

</div>

<script>
const WORKER_URL = '';  // 같은 origin이면 빈 문자열 OK

let allKeywords = [];

async function search() {
  const q = document.getElementById('queryInput').value.trim();
  if (!q) { alert('키워드를 입력하세요.'); return; }

  const btn = document.getElementById('searchBtn');
  btn.disabled = true;
  btn.textContent = '⏳ 수집 중...';

  document.getElementById('results').innerHTML = \`
    <div class="loading">
      <div class="loading-spinner"></div>
      <div>Google · Naver · Daum에서 키워드 수집 중...</div>
    </div>\`;

  try {
    const res = await fetch(\`\${WORKER_URL}/api/keywords?q=\${encodeURIComponent(q)}\`);
    const data = await res.json();
    allKeywords = data.keywords || [];
    renderResults(data);
  } catch(e) {
    document.getElementById('results').innerHTML = '<div class="empty">❌ 오류가 발생했습니다. 다시 시도해주세요.</div>';
  }

  btn.disabled = false;
  btn.textContent = '🔍 키워드 발굴';
}

function renderResults(data) {
  if (!data.keywords || data.keywords.length === 0) {
    document.getElementById('results').innerHTML = '<div class="empty">결과가 없습니다. 다른 키워드를 시도해보세요.</div>';
    return;
  }

  let html = \`
    <div class="summary">
      <div class="sum-card"><div class="sum-num">\${data.total}</div><div class="sum-label">총 키워드</div></div>
      <div class="sum-card"><div class="sum-num">\${data.summary.google}</div><div class="sum-label">Google</div></div>
      <div class="sum-card"><div class="sum-num">\${data.summary.naver}</div><div class="sum-label">Naver</div></div>
      <div class="sum-card"><div class="sum-num">\${data.summary.daum}</div><div class="sum-label">Daum</div></div>
      <div class="sum-card"><div class="sum-num">\${data.summary.multiSource}</div><div class="sum-label">복수소스</div></div>
      <div class="sum-card"><div class="sum-num">\${data.summary.longTail}</div><div class="sum-label">롱테일</div></div>
    </div>
    <div class="export-bar">
      <button class="export-btn" onclick="exportCSV()">📥 CSV 내보내기</button>
      <button class="export-btn" onclick="copyHighPotential()">⭐ HIGH 복사</button>
    </div>
    <div class="filters">
      <button class="filter-btn active" onclick="filterKw('all',this)">전체</button>
      <button class="filter-btn" onclick="filterKw('HIGH',this)">🟢 HIGH</button>
      <button class="filter-btn" onclick="filterKw('MED',this)">🟡 MED</button>
      <button class="filter-btn" onclick="filterKw('longtail',this)">롱테일</button>
      <button class="filter-btn" onclick="filterKw('multi',this)">복수소스</button>
      <button class="filter-btn" onclick="filterKw('google',this)">Google</button>
      <button class="filter-btn" onclick="filterKw('naver',this)">Naver</button>
      <button class="filter-btn" onclick="filterKw('daum',this)">Daum</button>
    </div>
    <div class="results" id="kwList">
      \${renderKeywordRows(data.keywords)}
    </div>\`;

  document.getElementById('results').innerHTML = html;
}

function renderKeywordRows(keywords) {
  return keywords.map(kw => \`
    <div class="kw-row">
      <div class="kw-text">\${escHtml(kw.keyword)}</div>
      <div class="kw-badges">
        \${kw.sources.includes('google') ? '<span class="badge badge-google">Google</span>' : ''}
        \${kw.sources.includes('naver')  ? '<span class="badge badge-naver">Naver</span>'  : ''}
        \${kw.sources.includes('daum')   ? '<span class="badge badge-daum">Daum</span>'    : ''}
        \${kw.isLongTail  ? '<span class="badge badge-longtail">롱테일</span>' : ''}
        \${kw.multiSource ? '<span class="badge badge-multi">복수소스</span>'  : ''}
      </div>
      <span class="potential pot-\${kw.potential}">\${kw.potential}</span>
      <button class="copy-btn" onclick="copyText('\${escHtml(kw.keyword)}',this)">복사</button>
    </div>\`).join('');
}

function filterKw(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  let filtered = allKeywords;
  if (type === 'HIGH')     filtered = allKeywords.filter(k => k.potential === 'HIGH');
  else if (type === 'MED') filtered = allKeywords.filter(k => k.potential === 'MED');
  else if (type === 'longtail') filtered = allKeywords.filter(k => k.isLongTail);
  else if (type === 'multi')    filtered = allKeywords.filter(k => k.multiSource);
  else if (type === 'google')   filtered = allKeywords.filter(k => k.sources.includes('google'));
  else if (type === 'naver')    filtered = allKeywords.filter(k => k.sources.includes('naver'));
  else if (type === 'daum')     filtered = allKeywords.filter(k => k.sources.includes('daum'));

  document.getElementById('kwList').innerHTML = renderKeywordRows(filtered);
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = '복사', 1500);
  });
}

function copyHighPotential() {
  const high = allKeywords.filter(k => k.potential === 'HIGH').map(k => k.keyword).join('\\n');
  navigator.clipboard.writeText(high).then(() => alert(\`HIGH 키워드 \${allKeywords.filter(k=>k.potential==='HIGH').length}개 복사됨!\`));
}

function exportCSV() {
  const rows = [['키워드','소스','잠재력','롱테일','복수소스','단어수']];
  allKeywords.forEach(k => rows.push([k.keyword, k.sources.join('+'), k.potential, k.isLongTail?'Y':'N', k.multiSource?'Y':'N', k.wordCount]));
  const csv = rows.map(r => r.map(c => \`"\${c}"\`).join(',')).join('\\n');
  const blob = new Blob(['\\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'keywords.csv'; a.click();
}

function escHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

document.getElementById('queryInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') search();
});
</script>
</body>
</html>`;
}
