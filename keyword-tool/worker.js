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
    if (url.pathname === "/api/keywords")  return handleKeywords(url);
    if (url.pathname === "/api/suggest")   return handleSuggest(url);
    if (url.pathname === "/api/seasonal")  return handleSeasonal(url);
    return new Response(getDashboardHTML(), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  },
};

// ── 절기/시즌 키워드 데이터베이스 (검증된 고트래픽 키워드) ─────────────────
const SEASONAL_DB = [
  // ── 1월 ──
  { month:1, days:[1,7],  tags:["new year","새해","신년"],
    en:["new year travel korea","new year in korea 2026","korea new year traditions","seoul new year countdown",
        "korea new year fireworks","new year eve korea","korea winter festival","korean new year customs",
        "best place new year korea","korea winter trip january"],
    ko:["한국 새해 여행","서울 새해 카운트다운","한국 신년 풍습","한국 겨울 축제 추천",
        "설날 준비물","새해 맞이 여행지","한국 겨울 여행 1월","새해 인사말 영어로"] },

  // ── 2월 (설날 가변 + 발렌타인) ──
  { month:2, days:[1,28], tags:["valentine","설날","lunar new year"],
    en:["valentine's day korea","korean valentine's day customs","pepero vs valentine korea",
        "lunar new year korea travel","seollal korea guide","korean new year food",
        "korea february travel","winter in korea february","korean red envelope tradition",
        "seollal holiday korea for foreigners"],
    ko:["설날 한국 풍습","발렌타인데이 한국","한국 설날 음식","설날 연휴 여행지",
        "설날 세뱃돈 문화","한국 2월 여행","설날 인사말","한국 겨울 2월 추천"] },

  // ── 3월 (삼일절 + 화이트데이 + 벚꽃 시작) ──
  { month:3, days:[1,31], tags:["white day","삼일절","봄 시작","spring"],
    en:["white day korea","korea spring cherry blossom forecast","cherry blossom korea march",
        "korea spring 2026","spring flowers korea","korea march travel","independence movement day korea",
        "best spring destinations korea","korea spring hiking","cherry blossom season start"],
    ko:["화이트데이 한국","한국 봄 여행","벚꽃 개화 시기 2026","삼일절 의미",
        "화이트데이 선물 추천","한국 3월 여행지","봄꽃 명소 추천","벚꽃 언제 피나"] },

  // ── 4월 (벚꽃 절정 + 부활절) ──
  { month:4, days:[1,30], tags:["cherry blossom","벚꽃","부활절","easter"],
    en:["cherry blossom korea april","best cherry blossom spots korea","seoul cherry blossom 2026",
        "korea cherry blossom festival","easter in korea","yeouido cherry blossom","jinhae cherry blossom",
        "cherry blossom hanbok photo","korea spring festival april","korea april travel guide"],
    ko:["벚꽃 명소 한국","서울 벚꽃 명소","진해 군항제 2026","여의도 벚꽃 축제",
        "부활절 한국 행사","한국 봄 축제 4월","벚꽃 데이트 코스","한국 4월 여행 추천"] },

  // ── 5월 (어린이날 + 어버이날 + 스승의날) ──
  { month:5, days:[1,31], tags:["children's day","어린이날","어버이날","parents day"],
    en:["children's day korea","korea family travel may","korea rose festival","buddha's birthday korea",
        "korea may travel guide","korea golden week","family trip korea","korea may holiday",
        "korea spring travel best","korea parents day tradition"],
    ko:["어린이날 가볼만한곳","어버이날 선물 추천","한국 5월 여행","스승의날 문화",
        "가족 여행지 추천","한국 장미 축제","부처님 오신날 한국","황금연휴 여행지"] },

  // ── 6월 (현충일 + 여름 시작) ──
  { month:6, days:[1,30], tags:["summer","여름","memorial day","현충일"],
    en:["korea summer travel","korea beach june","korea june travel guide","korea summer festivals",
        "busan beach summer","korea rainy season tips","korea memorial day","jeju summer travel",
        "korea summer food","korea summer activities for foreigners"],
    ko:["한국 여름 여행","한국 해수욕장 추천","여름 축제 한국","장마철 여행 팁",
        "부산 해수욕장 추천","한국 여름 음식","현충일 의미","6월 한국 여행"] },

  // ── 7월 (여름 성수기) ──
  { month:7, days:[1,31], tags:["summer peak","여름 성수기","boryeong mud"],
    en:["korea summer vacation","boryeong mud festival 2026","korea july travel","korea summer heat tips",
        "best beaches korea summer","korea waterpark","hangang summer night","korea camping summer",
        "korea summer festival july","jeju water activities"],
    ko:["보령 머드 축제 2026","한국 여름 휴가지","한강 물놀이","한국 워터파크 추천",
        "여름 캠핑 한국","제주 물놀이","한국 7월 여행","여름 한국 피서지 추천"] },

  // ── 8월 (광복절 + 한여름) ──
  { month:8, days:[1,31], tags:["independence day","광복절","late summer"],
    en:["korea independence day","korea august travel","late summer korea","korea summer ending trip",
        "korea traditional games","korea august festivals","busan sea festival","korea summer discount",
        "jeju august guide","korea end of summer travel"],
    ko:["광복절 의미","한국 8월 여행","여름 끝 여행지","한국 전통 놀이",
        "부산 바다 축제","제주 8월 여행","한국 여름 할인","늦여름 한국 여행"] },

  // ── 9월 (추석 + 가을 시작) ──
  { month:9, days:[1,30], tags:["chuseok","추석","autumn","단풍 시작"],
    en:["chuseok korea","korean thanksgiving","chuseok holiday korea travel","korea autumn start",
        "chuseok food guide","korea september travel","korean harvest festival","chuseok for foreigners",
        "korea fall foliage forecast","chuseok traditions explained"],
    ko:["추석 풍습","추석 연휴 여행지","한국 추석 음식","외국인 추석 체험",
        "한국 가을 여행 9월","추석 차례 방법","단풍 시기 예측","한국 9월 여행 추천"] },

  // ── 10월 (단풍 절정 + 핼러윈) ──
  { month:10, days:[1,31], tags:["fall foliage","단풍","halloween","핼러윈"],
    en:["korea fall foliage","best autumn leaves korea","korea october travel","naejangsan autumn",
        "seoraksan fall foliage","halloween in korea","itaewon halloween","korea autumn hiking",
        "korea red leaves spots","korea october festival"],
    ko:["한국 단풍 명소","내장산 단풍","설악산 단풍 시기","한국 핼러윈",
        "이태원 핼러윈","한국 가을 등산 추천","단풍 드라이브 코스","10월 한국 여행"] },

  // ── 11월 (빼빼로데이 + 수능) ──
  { month:11, days:[1,30], tags:["pepero day","빼빼로데이","수능"],
    en:["pepero day korea","november in korea","korea november travel","korea college entrance exam",
        "pepero day customs korea","korea late autumn","korea november festival","korean snack culture",
        "korea winter approaching","seoul november guide"],
    ko:["빼빼로데이 유래","빼빼로 선물 아이디어","수능 날짜 2026","한국 11월 여행",
        "늦가을 한국 여행지","빼빼로데이 뭐하나","한국 겨울 준비","서울 11월 추천"] },

  // ── 12월 (크리스마스 + 연말) ──
  { month:12, days:[1,31], tags:["christmas","크리스마스","연말","year end"],
    en:["christmas in korea","korea christmas traditions","seoul christmas lights","korea winter travel december",
        "korea christmas market","new year countdown korea","korea year end party","korea winter illumination",
        "best christmas spots korea","korea december travel guide"],
    ko:["한국 크리스마스 문화","서울 크리스마스 명소","한국 겨울 여행 12월","크리스마스 한국 풍습",
        "연말 한국 여행","서울 빛축제","크리스마스 데이트 코스 서울","한국 겨울 일루미네이션"] },
];

// ── 오늘 날짜 기준 시즌 키워드 자동 선택 ────────────────────────────────────
function getSeasonalKeywords(dateStr) {
  const today = dateStr ? new Date(dateStr) : new Date();
  const month = today.getMonth() + 1;

  // 현재 월 + 앞뒤 1개월 데이터 포함 (미리 준비)
  const relevant = SEASONAL_DB.filter(s => {
    const diff = ((s.month - month + 12) % 12);
    return diff <= 1 || diff >= 11; // 이번달 + 다음달 + 지난달
  });

  const all = [];
  relevant.forEach(s => {
    s.en.forEach(k => all.push({ keyword: k, lang: "en", tags: s.tags, month: s.month }));
    s.ko.forEach(k => all.push({ keyword: k, lang: "ko", tags: s.tags, month: s.month }));
  });

  // 현재 월이 가장 앞으로, 다음달 그 다음
  all.sort((a, b) => {
    const da = (a.month - month + 12) % 12;
    const db = (b.month - month + 12) % 12;
    return da - db;
  });

  // 중복 제거 후 50개
  const seen = new Set();
  return all.filter(k => {
    if (seen.has(k.keyword)) return false;
    seen.add(k.keyword);
    return true;
  }).slice(0, 50).map((k, i) => ({
    rank: i + 1,
    keyword: k.keyword,
    lang: k.lang,
    tags: k.tags,
    month: k.month,
    monthLabel: `${k.month}월`,
    isCurrentMonth: k.month === month,
    potential: "HIGH",
    source: "seasonal",
    intent: k.lang === "ko" ? "📅 시즌/절기" : "📅 Seasonal",
  }));
}

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
async function handleSeasonal(url) {
  const dateStr = url.searchParams.get("date") || null;
  const keywords = getSeasonalKeywords(dateStr);
  const today = dateStr ? new Date(dateStr) : new Date();
  return json({
    date: today.toISOString().slice(0, 10),
    month: today.getMonth() + 1,
    total: keywords.length,
    keywords,
  });
}

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
.tabs{display:flex;gap:4px;margin-bottom:24px;background:#1e293b;padding:6px;border-radius:12px;border:1px solid rgba(255,255,255,.08)}
.tab{flex:1;text-align:center;padding:10px 16px;border-radius:8px;font-size:.88rem;font-weight:700;cursor:pointer;transition:.18s;color:#64748b;border:none;background:transparent}
.tab.on{background:#e8a020;color:#0f172a}
.tab:hover:not(.on){background:rgba(255,255,255,.06);color:#94a3b8}
.season-header{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.season-today{font-size:.85rem;color:#94a3b8}
.season-today strong{color:#e8a020;font-size:1rem}
.season-badge{background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);color:#a78bfa;font-size:.75rem;font-weight:700;padding:4px 12px;border-radius:100px}
.season-filters{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.season-card{background:#1e293b;border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:14px;margin-bottom:8px;transition:.18s}
.season-card:hover{background:#243044;border-color:rgba(232,160,32,.2)}
.season-rank{font-size:.78rem;font-weight:800;color:#334155;width:28px;text-align:center;flex-shrink:0}
.season-kw{flex:1;font-size:.93rem;color:#e2e8f0;font-weight:500}
.season-month{font-size:.72rem;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);color:#818cf8;padding:2px 8px;border-radius:5px;white-space:nowrap}
.season-month.cur{background:rgba(232,160,32,.12);border-color:rgba(232,160,32,.3);color:#e8a020}
.season-tag{font-size:.68rem;background:rgba(20,184,166,.1);border:1px solid rgba(20,184,166,.25);color:#2dd4bf;padding:2px 7px;border-radius:5px;white-space:nowrap}
.season-lang{font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:5px}
.lang-en{background:rgba(66,133,244,.1);color:#4285f4;border:1px solid rgba(66,133,244,.25)}
.lang-ko{background:rgba(3,199,90,.1);color:#03c75a;border:1px solid rgba(3,199,90,.25)}
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
  <!-- 탭 -->
  <div class="tabs">
    <button class="tab on" onclick="switchTab('search',this)">🔍 키워드 검색</button>
    <button class="tab" onclick="switchTab('seasonal',this)">📅 시즌 추천</button>
  </div>

  <!-- 검색 탭 -->
  <div id="tabSearch">
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
  </div><!-- /tabSearch -->

  <!-- 시즌 탭 -->
  <div id="tabSeasonal" style="display:none">
    <div class="season-header">
      <div class="season-today">오늘 기준 시즌 키워드 자동 추천 — <strong id="todayLabel"></strong></div>
      <span class="season-badge">📅 검증된 고트래픽 시즌 키워드 50개</span>
    </div>
    <div class="season-filters">
      <button class="filter-btn on" onclick="sfilt('all',this)">전체</button>
      <button class="filter-btn" onclick="sfilt('current',this)">🔥 이번달</button>
      <button class="filter-btn" onclick="sfilt('en',this)">🇺🇸 영어</button>
      <button class="filter-btn" onclick="sfilt('ko',this)">🇰🇷 한국어</button>
    </div>
    <div id="seasonList"></div>
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="export-btn" onclick="csvSeasonal()">📥 CSV 내보내기</button>
      <button class="export-btn" onclick="copyAllSeasonal()">📋 전체 복사</button>
    </div>
  </div><!-- /tabSeasonal -->

</div>

<script>
let all = [];
let seasonAll = [];

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

// ── 탭 전환 ──────────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('tabSearch').style.display   = tab === 'search'   ? '' : 'none';
  document.getElementById('tabSeasonal').style.display = tab === 'seasonal' ? '' : 'none';
  if (tab === 'seasonal' && !seasonAll.length) loadSeasonal();
}

// ── 시즌 키워드 로드 ──────────────────────────────────────────────────────────
async function loadSeasonal() {
  document.getElementById('seasonList').innerHTML =
    '<div class="loading"><div class="spin"></div><div>시즌 키워드 분석 중...</div></div>';
  try {
    const res  = await fetch('/api/seasonal');
    const data = await res.json();
    seasonAll  = data.keywords || [];
    const d = new Date();
    document.getElementById('todayLabel').textContent =
      d.getFullYear() + '년 ' + (d.getMonth()+1) + '월 ' + d.getDate() + '일';
    renderSeasonal(seasonAll);
  } catch(e) {
    document.getElementById('seasonList').innerHTML = '<div class="empty">❌ 오류 발생</div>';
  }
}

function renderSeasonal(kws) {
  if (!kws.length) { document.getElementById('seasonList').innerHTML = '<div class="empty">결과 없음</div>'; return; }
  document.getElementById('seasonList').innerHTML = kws.map((k,i) => \`
    <div class="season-card">
      <span class="season-rank">\${i+1}</span>
      <span class="season-kw">\${esc(k.keyword)}</span>
      <span class="season-lang \${k.lang==='en'?'lang-en':'lang-ko'}">\${k.lang==='en'?'EN':'KO'}</span>
      <span class="season-month \${k.isCurrentMonth?'cur':''}">\${k.monthLabel}</span>
      \${k.tags.slice(0,2).map(t=>\`<span class="season-tag">\${esc(t)}</span>\`).join('')}
      <button class="copy-btn" onclick="cp('\${esc(k.keyword)}',this)">복사</button>
    </div>\`).join('');
}

function sfilt(type, btn) {
  document.querySelectorAll('.season-filters .filter-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  let f = seasonAll;
  if (type==='current') f = seasonAll.filter(k=>k.isCurrentMonth);
  else if(type==='en')  f = seasonAll.filter(k=>k.lang==='en');
  else if(type==='ko')  f = seasonAll.filter(k=>k.lang==='ko');
  renderSeasonal(f);
}

function csvSeasonal() {
  const rows = [['순위','키워드','언어','월','태그','잠재력']];
  seasonAll.forEach(k => rows.push([k.rank, k.keyword, k.lang, k.monthLabel, k.tags.join('+'), k.potential]));
  const c = rows.map(r=>r.map(v=>\`"\${v}"\`).join(',')).join('\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\\uFEFF'+c],{type:'text/csv;charset=utf-8'}));
  a.download='seasonal-keywords.csv'; a.click();
}

function copyAllSeasonal() {
  const text = seasonAll.map(k=>k.keyword).join('\\n');
  navigator.clipboard.writeText(text).then(()=>alert('시즌 키워드 '+seasonAll.length+'개 복사됨!'));
}
</script>
</body>
</html>`;
}
