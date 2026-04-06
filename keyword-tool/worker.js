/**
 * Keyword Research Tool — Cloudflare Worker v3
 * Worker: CORS 프록시 + 시즌 키워드
 * Browser: 씨드 생성 + 병렬 호출 + 집계 (Worker CPU 제한 우회)
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    // /api/proxy?source=google|naver|daum&q=...  — 단일 자동완성 CORS 프록시
    if (url.pathname === "/api/proxy") return handleProxy(url);

    // /api/seasonal  — 날짜 기반 시즌 키워드 50개
    if (url.pathname === "/api/seasonal") return handleSeasonal();
    if (url.pathname === "/api/trending") return handleTrending(url);

    return new Response(getDashboardHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};

// ── 단일 자동완성 프록시 ───────────────────────────────────────────────────
async function handleProxy(url) {
  const source = url.searchParams.get("source") || "google";
  const q      = url.searchParams.get("q");
  if (!q) return json({ error: "q required" }, 400);

  let results = [];
  if      (source === "google") results = await fetchGoogle(q);
  else if (source === "naver")  results = await fetchNaver(q);
  else if (source === "daum")   results = await fetchDaum(q);

  return json({ source, q, results });
}

async function fetchGoogle(q) {
  try {
    const hl  = /[ㄱ-ㅎ가-힣]/.test(q) ? "ko" : "en";
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&hl=${hl}&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, cf: { cacheTtl: 1800 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data[1] || []).slice(0, 10);
  } catch { return []; }
}

async function fetchNaver(q) {
  try {
    const res = await fetch(
      `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(q)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&q_enc=UTF-8&st=100`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.naver.com" }, cf: { cacheTtl: 1800 } }
    );
    if (!res.ok) return [];
    const data = JSON.parse(await res.text());
    return (data?.items?.[0] || []).map(i => Array.isArray(i) ? i[0] : i).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

async function fetchDaum(q) {
  try {
    const res = await fetch(
      `https://suggest-bar.daum.net/suggest?q=${encodeURIComponent(q)}&mod=json&output=json`,
      { headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.daum.net" }, cf: { cacheTtl: 1800 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.items || []).map(i => i?.query || i).filter(Boolean).slice(0, 10);
  } catch { return []; }
}

// ── 시즌 키워드 DB ────────────────────────────────────────────────────────────
const SEASONAL_DB = [
  { month:1,  en:["new year travel korea","new year in korea 2026","korea new year traditions","seoul new year countdown","korea winter festival january","korean new year customs","best place new year korea","korea winter trip january","korea new year fireworks","seoul winter activities"],
               ko:["한국 새해 여행","서울 새해 카운트다운","한국 신년 풍습","한국 겨울 축제 추천","설날 준비물","새해 맞이 여행지","한국 겨울 여행 1월","새해 인사말 영어로"] },
  { month:2,  en:["valentine's day korea","korean valentine customs","lunar new year korea","seollal korea guide","korean new year food","korea february travel","winter korea february","korean red envelope tradition","seollal holiday foreigners","pepero vs valentine korea"],
               ko:["설날 한국 풍습","발렌타인데이 한국","한국 설날 음식","설날 연휴 여행지","설날 세뱃돈 문화","한국 2월 여행","설날 인사말","한국 겨울 2월 추천"] },
  { month:3,  en:["white day korea","korea spring cherry blossom forecast","cherry blossom korea march","korea spring 2026","spring flowers korea","korea march travel","independence movement day korea","best spring destinations korea","korea spring hiking","cherry blossom season start"],
               ko:["화이트데이 한국","한국 봄 여행","벚꽃 개화 시기 2026","삼일절 의미","화이트데이 선물 추천","한국 3월 여행지","봄꽃 명소 추천","벚꽃 언제 피나"] },
  { month:4,  en:["cherry blossom korea april","best cherry blossom spots korea","seoul cherry blossom 2026","korea cherry blossom festival","easter in korea","yeouido cherry blossom","jinhae cherry blossom","cherry blossom hanbok photo","korea spring festival april","korea april travel guide"],
               ko:["벚꽃 명소 한국","서울 벚꽃 명소","진해 군항제 2026","여의도 벚꽃 축제","부활절 한국 행사","한국 봄 축제 4월","벚꽃 데이트 코스","한국 4월 여행 추천"] },
  { month:5,  en:["children's day korea","korea family travel may","korea rose festival","buddha's birthday korea","korea may travel guide","korea golden week","family trip korea","korea may holiday","korea spring travel best","korea parents day tradition"],
               ko:["어린이날 가볼만한곳","어버이날 선물 추천","한국 5월 여행","스승의날 문화","가족 여행지 추천","한국 장미 축제","부처님 오신날 한국","황금연휴 여행지"] },
  { month:6,  en:["korea summer travel","korea beach june","korea june travel guide","korea summer festivals","busan beach summer","korea rainy season tips","korea memorial day","jeju summer travel","korea summer food","korea summer activities foreigners"],
               ko:["한국 여름 여행","한국 해수욕장 추천","여름 축제 한국","장마철 여행 팁","부산 해수욕장 추천","한국 여름 음식","현충일 의미","6월 한국 여행"] },
  { month:7,  en:["korea summer vacation","boryeong mud festival 2026","korea july travel","korea summer heat tips","best beaches korea summer","korea waterpark","hangang summer night","korea camping summer","korea summer festival july","jeju water activities"],
               ko:["보령 머드 축제 2026","한국 여름 휴가지","한강 물놀이","한국 워터파크 추천","여름 캠핑 한국","제주 물놀이","한국 7월 여행","여름 한국 피서지 추천"] },
  { month:8,  en:["korea independence day","korea august travel","late summer korea","korea summer ending trip","korea traditional games","korea august festivals","busan sea festival","korea summer discount","jeju august guide","korea end of summer travel"],
               ko:["광복절 의미","한국 8월 여행","여름 끝 여행지","한국 전통 놀이","부산 바다 축제","제주 8월 여행","한국 여름 할인","늦여름 한국 여행"] },
  { month:9,  en:["chuseok korea","korean thanksgiving","chuseok holiday korea travel","korea autumn start","chuseok food guide","korea september travel","korean harvest festival","chuseok for foreigners","korea fall foliage forecast","chuseok traditions explained"],
               ko:["추석 풍습","추석 연휴 여행지","한국 추석 음식","외국인 추석 체험","한국 가을 여행 9월","추석 차례 방법","단풍 시기 예측","한국 9월 여행 추천"] },
  { month:10, en:["korea fall foliage","best autumn leaves korea","korea october travel","naejangsan autumn","seoraksan fall foliage","halloween in korea","itaewon halloween","korea autumn hiking","korea red leaves spots","korea october festival"],
               ko:["한국 단풍 명소","내장산 단풍","설악산 단풍 시기","한국 핼러윈","이태원 핼러윈","한국 가을 등산 추천","단풍 드라이브 코스","10월 한국 여행"] },
  { month:11, en:["pepero day korea","november in korea","korea november travel","korea college entrance exam","pepero day customs korea","korea late autumn","korea november festival","korean snack culture","korea winter approaching","seoul november guide"],
               ko:["빼빼로데이 유래","빼빼로 선물 아이디어","수능 날짜 2026","한국 11월 여행","늦가을 한국 여행지","빼빼로데이 뭐하나","한국 겨울 준비","서울 11월 추천"] },
  { month:12, en:["christmas in korea","korea christmas traditions","seoul christmas lights","korea winter travel december","korea christmas market","new year countdown korea","korea year end party","korea winter illumination","best christmas spots korea","korea december travel guide"],
               ko:["한국 크리스마스 문화","서울 크리스마스 명소","한국 겨울 여행 12월","크리스마스 한국 풍습","연말 한국 여행","서울 빛축제","크리스마스 데이트 코스 서울","한국 겨울 일루미네이션"] },
];

// ── 인기 트렌드 DB (네이버 지식인/리뷰/검색량 기반 검증 데이터) ──────────────────
const TRENDING_DB = [
  // 카테고리: 건강/뷰티 (구매 빈도 최상위)
  { cat:"건강/뷰티", rank:1,  en:"korean red ginseng benefits",      ko:"홍삼 효능",           intent:"💰 구매/비용", tags:["후기많음","지식인인기"] },
  { cat:"건강/뷰티", rank:2,  en:"korean collagen supplement review", ko:"콜라겐 추천",          intent:"⭐ 후기/비교", tags:["리뷰폭발","구매전환높음"] },
  { cat:"건강/뷰티", rank:3,  en:"korean probiotics best brand",      ko:"유산균 제품 추천",      intent:"💰 구매/비용", tags:["지식인인기"] },
  { cat:"건강/뷰티", rank:4,  en:"korean vitamin d supplement",       ko:"비타민D 결핍 증상",     intent:"📖 방법/가이드", tags:["검색량높음"] },
  { cat:"건강/뷰티", rank:5,  en:"korean sunscreen recommendation",   ko:"선크림 추천 한국",      intent:"💰 구매/비용", tags:["복수소스인기","리뷰폭발"] },
  { cat:"건강/뷰티", rank:6,  en:"korean skincare routine order",     ko:"스킨케어 순서",         intent:"📖 방법/가이드", tags:["지식인인기"] },
  { cat:"건강/뷰티", rank:7,  en:"korean hair loss treatment",        ko:"탈모 샴푸 추천",        intent:"💰 구매/비용", tags:["구매전환높음","후기많음"] },
  { cat:"건강/뷰티", rank:8,  en:"korean eye cream review",           ko:"눈크림 추천",           intent:"⭐ 후기/비교", tags:["리뷰폭발"] },

  // 카테고리: 음식/요리 (검색량 최상위)
  { cat:"음식/요리", rank:1,  en:"korean fried chicken recipe",       ko:"치킨 양념 만들기",      intent:"📖 방법/가이드", tags:["검색량높음","유튜브인기"] },
  { cat:"음식/요리", rank:2,  en:"korean instant noodle best brand",  ko:"라면 추천 종류",        intent:"⭐ 후기/비교", tags:["리뷰폭발"] },
  { cat:"음식/요리", rank:3,  en:"korean bbq home setup",             ko:"집에서 삼겹살 굽는법",   intent:"📖 방법/가이드", tags:["지식인인기"] },
  { cat:"음식/요리", rank:4,  en:"kimchi recipe for beginners",       ko:"김치 담그는 법 초보",    intent:"🌱 입문/초보", tags:["검색량높음","지식인인기"] },
  { cat:"음식/요리", rank:5,  en:"korean soy sauce chicken recipe",   ko:"간장치킨 만들기",        intent:"📖 방법/가이드", tags:["유튜브인기"] },
  { cat:"음식/요리", rank:6,  en:"korean street food list",           ko:"분식 종류 추천",         intent:"📌 정보", tags:["검색량높음"] },
  { cat:"음식/요리", rank:7,  en:"korean tteok delivery near me",     ko:"떡볶이 맛집 추천",       intent:"💰 구매/비용", tags:["지역검색높음"] },
  { cat:"음식/요리", rank:8,  en:"best korean ramen brands 2026",     ko:"라면 브랜드 순위",       intent:"⭐ 후기/비교", tags:["리뷰폭발"] },

  // 카테고리: 전자제품 (구매전환 최상위)
  { cat:"전자제품",  rank:1,  en:"best korean air purifier review",   ko:"공기청정기 추천",        intent:"💰 구매/비용", tags:["구매전환높음","리뷰폭발"] },
  { cat:"전자제품",  rank:2,  en:"samsung vs lg refrigerator",        ko:"냉장고 삼성 LG 비교",    intent:"⭐ 후기/비교", tags:["지식인인기","구매전환높음"] },
  { cat:"전자제품",  rank:3,  en:"korean robot vacuum comparison",    ko:"로봇청소기 추천 2026",   intent:"💰 구매/비용", tags:["리뷰폭발","구매전환높음"] },
  { cat:"전자제품",  rank:4,  en:"wireless earbuds review korea",     ko:"무선이어폰 추천",         intent:"⭐ 후기/비교", tags:["리뷰폭발"] },
  { cat:"전자제품",  rank:5,  en:"portable projector best pick",      ko:"빔프로젝터 추천 가성비",  intent:"💰 구매/비용", tags:["지식인인기"] },
  { cat:"전자제품",  rank:6,  en:"korean electric blanket review",    ko:"전기장판 추천",          intent:"💰 구매/비용", tags:["후기많음","계절인기"] },
  { cat:"전자제품",  rank:7,  en:"best korean laptop 2026",           ko:"노트북 추천 2026",        intent:"💰 구매/비용", tags:["구매전환높음","검색량높음"] },
  { cat:"전자제품",  rank:8,  en:"korean air fryer recommendation",   ko:"에어프라이어 추천",       intent:"💰 구매/비용", tags:["리뷰폭발","구매전환높음"] },

  // 카테고리: 한국 여행 (외국인 대상 — 블로그 주력)
  { cat:"한국여행",  rank:1,  en:"korea travel budget guide 2026",    ko:"한국 여행 경비 절약",     intent:"💰 구매/비용", tags:["검색량높음","외국인인기"] },
  { cat:"한국여행",  rank:2,  en:"seoul must visit places 2026",      ko:"서울 필수 관광지",        intent:"📌 정보", tags:["외국인인기","검색량높음"] },
  { cat:"한국여행",  rank:3,  en:"busan one day trip itinerary",      ko:"부산 당일치기 코스",       intent:"📖 방법/가이드", tags:["지식인인기"] },
  { cat:"한국여행",  rank:4,  en:"korea sim card recommendation",     ko:"한국 유심 추천 외국인",    intent:"💰 구매/비용", tags:["외국인인기","구매전환높음"] },
  { cat:"한국여행",  rank:5,  en:"best korean food to try first",     ko:"한국 음식 처음 먹어볼것",  intent:"🌱 입문/초보", tags:["외국인인기"] },
  { cat:"한국여행",  rank:6,  en:"korea visa free country list",      ko:"한국 무비자 국가",         intent:"📌 정보", tags:["검색량높음"] },
  { cat:"한국여행",  rank:7,  en:"jeju island complete guide",        ko:"제주도 여행 완벽 가이드",  intent:"📖 방법/가이드", tags:["검색량높음","외국인인기"] },
  { cat:"한국여행",  rank:8,  en:"korea t-money card how to use",    ko:"티머니 카드 사용법",        intent:"📖 방법/가이드", tags:["외국인인기","지식인인기"] },

  // 카테고리: 한국어 학습 (지식인 질문 폭발)
  { cat:"한국어학습", rank:1, en:"how to learn korean fast",          ko:"한국어 빠르게 배우는 법",  intent:"🌱 입문/초보", tags:["지식인인기","검색량높음"] },
  { cat:"한국어학습", rank:2, en:"korean honorifics explained",       ko:"한국어 존댓말 반말 차이",  intent:"📖 방법/가이드", tags:["지식인인기"] },
  { cat:"한국어학습", rank:3, en:"best app to learn korean 2026",     ko:"한국어 공부 앱 추천",      intent:"💰 구매/비용", tags:["리뷰폭발","검색량높음"] },
  { cat:"한국어학습", rank:4, en:"korean alphabet chart printable",   ko:"한글 자음 모음 표",        intent:"📌 정보", tags:["외국인인기"] },
  { cat:"한국어학습", rank:5, en:"korean slang for beginners",        ko:"한국어 슬랭 사용법",       intent:"🌱 입문/초보", tags:["유튜브인기"] },
  { cat:"한국어학습", rank:6, en:"topik exam preparation tips",       ko:"토픽 시험 준비 방법",      intent:"📖 방법/가이드", tags:["지식인인기","구매전환높음"] },
  { cat:"한국어학습", rank:7, en:"korean numbers system explained",   ko:"한국어 숫자 읽는 법",      intent:"📖 방법/가이드", tags:["지식인인기"] },
  { cat:"한국어학습", rank:8, en:"dramas to learn korean",            ko:"한국어 공부 드라마 추천",   intent:"⭐ 후기/비교", tags:["유튜브인기"] },

  // 카테고리: 주거/생활 (지식인 질문 다수)
  { cat:"주거/생활",  rank:1, en:"korea apartment rental guide",      ko:"한국 원룸 구하는 법",      intent:"📖 방법/가이드", tags:["지식인인기","외국인인기"] },
  { cat:"주거/생활",  rank:2, en:"korean mattress topper review",     ko:"매트리스 토퍼 추천",        intent:"💰 구매/비용", tags:["리뷰폭발"] },
  { cat:"주거/생활",  rank:3, en:"korea utility bills saving tips",   ko:"전기세 절약 방법",          intent:"📖 방법/가이드", tags:["지식인인기"] },
  { cat:"주거/생활",  rank:4, en:"best korean cleaning products",     ko:"청소용품 추천 가성비",       intent:"💰 구매/비용", tags:["리뷰폭발"] },
  { cat:"주거/생활",  rank:5, en:"korean interior design aesthetic",  ko:"한국 인테리어 트렌드",       intent:"📌 정보", tags:["검색량높음"] },
  { cat:"주거/생활",  rank:6, en:"dehumidifier korea recommendation", ko:"제습기 추천 여름",           intent:"💰 구매/비용", tags:["계절인기","구매전환높음"] },
  { cat:"주거/생활",  rank:7, en:"korea food storage containers",     ko:"밀폐용기 추천 브랜드",       intent:"💰 구매/비용", tags:["리뷰폭발"] },
  { cat:"주거/생활",  rank:8, en:"korean laundry detergent review",   ko:"세탁세제 추천",              intent:"⭐ 후기/비교", tags:["리뷰폭발"] },
];

async function handleTrending(url) {
  const cat = url.searchParams.get("cat") || "all";
  const lang = url.searchParams.get("lang") || "all";

  let items = TRENDING_DB;
  if (cat !== "all") items = items.filter(i => i.cat === cat);

  const results = items.flatMap(item => {
    const out = [];
    if (lang !== "ko") out.push({ keyword: item.en, lang: "en", cat: item.cat, intent: item.intent, tags: item.tags, potential: "HIGH", rank: item.rank });
    if (lang !== "en") out.push({ keyword: item.ko, lang: "ko", cat: item.cat, intent: item.intent, tags: item.tags, potential: "HIGH", rank: item.rank });
    return out;
  });

  const cats = [...new Set(TRENDING_DB.map(i => i.cat))];
  return json({ total: results.length, cats, keywords: results });
}

async function handleSeasonal() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const results = [];
  // 이번달 → 다음달 → 그 다음달 순
  for (let d = 0; d <= 2; d++) {
    const m = ((month - 1 + d) % 12) + 1;
    const entry = SEASONAL_DB.find(s => s.month === m);
    if (!entry) continue;
    entry.en.forEach(k => results.push({ keyword: k, lang: "en", month: m, monthLabel: `${m}월`, isCurrentMonth: m === month, potential: "HIGH", intent: "📅 Seasonal" }));
    entry.ko.forEach(k => results.push({ keyword: k, lang: "ko", month: m, monthLabel: `${m}월`, isCurrentMonth: m === month, potential: "HIGH", intent: "📅 시즌/절기" }));
  }
  const seen = new Set();
  const deduped = results.filter(k => { if (seen.has(k.keyword)) return false; seen.add(k.keyword); return true; }).slice(0, 50);
  deduped.forEach((k, i) => k.rank = i + 1);
  return json({ date: today.toISOString().slice(0, 10), month, total: deduped.length, keywords: deduped });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json;charset=UTF-8" },
  });
}

// ── 대시보드 HTML (브라우저가 씨드 루프 + 집계 담당) ─────────────────────────
function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>키워드 리서치 툴 v3</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.hdr{background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:1px solid rgba(255,255,255,.08);padding:18px 28px;display:flex;align-items:center;justify-content:space-between}
.hdr h1{font-size:1.35rem;font-weight:800;color:#fff}.hdr h1 span{color:#e8a020}
.hdr-sub{font-size:.78rem;color:#64748b;margin-top:2px}
.ver{font-size:.7rem;background:rgba(232,160,32,.15);border:1px solid rgba(232,160,32,.3);color:#e8a020;padding:3px 9px;border-radius:100px;font-weight:700}
.main{max-width:1280px;margin:0 auto;padding:24px 20px}
.tabs{display:flex;gap:4px;margin-bottom:22px;background:#1e293b;padding:5px;border-radius:11px;border:1px solid rgba(255,255,255,.07)}
.tab{flex:1;text-align:center;padding:9px 14px;border-radius:7px;font-size:.86rem;font-weight:700;cursor:pointer;color:#64748b;border:none;background:transparent;transition:.15s}
.tab.on{background:#e8a020;color:#0f172a}
.tab:hover:not(.on){background:rgba(255,255,255,.05);color:#94a3b8}
.sbox{background:#1e293b;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:22px 26px;margin-bottom:24px}
.srow{display:flex;gap:10px;flex-wrap:wrap}
.sinput{flex:1;min-width:260px;background:#0f172a;border:1.5px solid rgba(255,255,255,.11);border-radius:9px;padding:12px 16px;font-size:.97rem;color:#fff;outline:none;transition:border-color .2s}
.sinput:focus{border-color:#e8a020}
.sinput::placeholder{color:#475569}
.sbtn{background:#e8a020;color:#0f172a;font-size:.95rem;font-weight:700;padding:12px 24px;border-radius:9px;border:none;cursor:pointer;transition:.18s;white-space:nowrap}
.sbtn:hover{background:#f0b030;transform:translateY(-1px)}
.sbtn:disabled{background:#334155;color:#64748b;cursor:not-allowed;transform:none}
.sinfo{font-size:.76rem;color:#475569;margin-top:9px}
.sinfo strong{color:#94a3b8}
.srcs{display:flex;gap:7px;margin-top:12px;flex-wrap:wrap}
.src{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;padding:4px 11px;font-size:.76rem;color:#94a3b8}
.dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.dg{background:#4285f4}.dn{background:#03c75a}.dd{background:#ff5722}
.prog{background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px 20px;margin-bottom:20px;display:none}
.prog-bar-wrap{background:#0f172a;border-radius:100px;height:6px;margin-top:10px;overflow:hidden}
.prog-bar{height:6px;background:linear-gradient(90deg,#e8a020,#f0b030);border-radius:100px;transition:width .3s;width:0%}
.prog-txt{font-size:.8rem;color:#64748b;margin-top:6px}
.sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-bottom:20px}
.sc{background:#1e293b;border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:16px;text-align:center}
.sn{font-size:1.8rem;font-weight:800;color:#e8a020;line-height:1}
.sl{font-size:.7rem;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:.06em}
.sc.hi .sn{color:#4ade80}
.tbar{display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.fb{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#94a3b8;padding:5px 12px;border-radius:6px;font-size:.78rem;cursor:pointer;transition:.15s;white-space:nowrap}
.fb.on,.fb:hover{background:rgba(232,160,32,.1);border-color:rgba(232,160,32,.3);color:#e8a020}
.exbtn{background:rgba(79,70,229,.1);border:1px solid rgba(79,70,229,.25);color:#818cf8;padding:5px 13px;border-radius:6px;font-size:.78rem;font-weight:700;cursor:pointer;transition:.15s;white-space:nowrap;margin-left:auto}
.exbtn:hover{background:rgba(79,70,229,.2)}
.kwtbl{width:100%;border-collapse:collapse}
.kwtbl th{text-align:left;font-size:.68rem;font-weight:700;color:#475569;letter-spacing:.08em;text-transform:uppercase;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
.kwr{border-bottom:1px solid rgba(255,255,255,.04);transition:background .12s}
.kwr:hover{background:rgba(255,255,255,.025)}
.kwr td{padding:10px 12px;vertical-align:middle}
.kwtxt{font-size:.9rem;color:#e2e8f0;font-weight:500}
.bgs{display:flex;gap:4px;flex-wrap:wrap}
.badge{font-size:.64rem;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap}
.bg{background:rgba(66,133,244,.12);color:#4285f4;border:1px solid rgba(66,133,244,.25)}
.bn{background:rgba(3,199,90,.1);color:#03c75a;border:1px solid rgba(3,199,90,.25)}
.bd{background:rgba(255,87,34,.1);color:#ff7043;border:1px solid rgba(255,87,34,.25)}
.bl{background:rgba(139,92,246,.1);color:#a78bfa;border:1px solid rgba(139,92,246,.25)}
.bm{background:rgba(232,160,32,.1);color:#e8a020;border:1px solid rgba(232,160,32,.25)}
.intent{font-size:.75rem;color:#64748b;white-space:nowrap}
.pot{font-size:.68rem;font-weight:800;padding:2px 8px;border-radius:4px;letter-spacing:.05em;white-space:nowrap}
.pH{background:rgba(34,197,94,.1);color:#4ade80;border:1px solid rgba(34,197,94,.25)}
.pM{background:rgba(234,179,8,.1);color:#facc15;border:1px solid rgba(234,179,8,.25)}
.pL{background:rgba(100,116,139,.1);color:#64748b;border:1px solid rgba(100,116,139,.18)}
.cpbtn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#475569;padding:3px 8px;border-radius:4px;font-size:.7rem;cursor:pointer;transition:.12s;white-space:nowrap}
.cpbtn:hover{background:rgba(232,160,32,.1);border-color:rgba(232,160,32,.3);color:#e8a020}
.empty{text-align:center;padding:50px 20px;color:#475569}
/* 트렌드 탭 */
.trhdr{background:#1e293b;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:18px 22px;margin-bottom:18px}
.trhdr-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px}
.trtitle{font-size:.9rem;color:#94a3b8}.trtitle strong{color:#f97316;font-size:1rem}
.catbar{display:flex;gap:6px;flex-wrap:wrap}
.catbtn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#94a3b8;padding:5px 13px;border-radius:6px;font-size:.78rem;cursor:pointer;transition:.15s;white-space:nowrap}
.catbtn.on,.catbtn:hover{background:rgba(249,115,22,.1);border-color:rgba(249,115,22,.35);color:#f97316}
.trcard{background:#1e293b;border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:11px 16px;display:flex;align-items:center;gap:12px;margin-bottom:7px;transition:.15s}
.trcard:hover{background:#1a2744;border-color:rgba(249,115,22,.2)}
.trcat{font-size:.65rem;font-weight:700;padding:2px 7px;border-radius:4px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.25);color:#f97316;white-space:nowrap;flex-shrink:0}
.trkw{flex:1;font-size:.9rem;color:#e2e8f0;font-weight:500}
.trtag{font-size:.63rem;padding:2px 6px;border-radius:4px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.22);color:#a78bfa;white-space:nowrap}
.tagsrow{display:flex;gap:3px;flex-wrap:wrap}
/* 시즌 탭 */
.shdr{background:#1e293b;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:18px 22px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.stday{font-size:.82rem;color:#94a3b8}.stday strong{color:#e8a020;font-size:.95rem}
.sbadge{background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.28);color:#a78bfa;font-size:.72rem;font-weight:700;padding:3px 11px;border-radius:100px}
.scard{background:#1e293b;border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:12px 16px;display:flex;align-items:center;gap:12px;margin-bottom:7px;transition:.15s}
.scard:hover{background:#1a2744;border-color:rgba(232,160,32,.2)}
.srank{font-size:.75rem;font-weight:800;color:#334155;width:26px;text-align:center;flex-shrink:0}
.skw{flex:1;font-size:.9rem;color:#e2e8f0;font-weight:500}
.smo{font-size:.68rem;padding:2px 7px;border-radius:4px;white-space:nowrap}
.smo.cur{background:rgba(232,160,32,.12);border:1px solid rgba(232,160,32,.28);color:#e8a020}
.smo.oth{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.22);color:#818cf8}
.slang{font-size:.65rem;font-weight:700;padding:2px 6px;border-radius:4px}
.len{background:rgba(66,133,244,.1);color:#4285f4;border:1px solid rgba(66,133,244,.22)}
.lko{background:rgba(3,199,90,.1);color:#03c75a;border:1px solid rgba(3,199,90,.22)}
@media(max-width:600px){.srow{flex-direction:column}.hdr{padding:14px 16px}.main{padding:16px 12px}}
</style>
</head>
<body>
<div class="hdr">
  <div><h1>🔍 키워드 <span>리서치</span> 툴</h1><div class="hdr-sub">Google · Naver · Daum 실전 키워드 발굴</div></div>
  <span class="ver">v3.0</span>
</div>
<div class="main">
  <div class="tabs">
    <button class="tab on" onclick="switchTab('search',this)">🔍 키워드 검색</button>
    <button class="tab"    onclick="switchTab('seasonal',this)">📅 시즌 추천</button>
    <button class="tab"    onclick="switchTab('trending',this)">🔥 인기 추천</button>
  </div>

  <!-- 검색 탭 -->
  <div id="tabSearch">
    <div class="sbox">
      <div class="srow">
        <input class="sinput" id="qi" placeholder="키워드 입력 (예: 간에 좋은, korea travel, learn korean)" />
        <button class="sbtn" id="sbtn" onclick="search()">🔍 키워드 발굴</button>
      </div>
      <div class="sinfo">영문: <strong>A-Z 확장 + 질문형</strong> | 한글: <strong>초성 + 방법/추천/후기</strong> — 브라우저에서 직접 수집</div>
      <div class="srcs">
        <div class="src"><span class="dot dg"></span>Google</div>
        <div class="src"><span class="dot dn"></span>Naver</div>
        <div class="src"><span class="dot dd"></span>Daum</div>
      </div>
    </div>
    <div class="prog" id="prog">
      <div style="font-size:.82rem;color:#94a3b8">수집 중... <span id="progCount">0</span> / <span id="progTotal">0</span> 요청</div>
      <div class="prog-bar-wrap"><div class="prog-bar" id="progBar"></div></div>
      <div class="prog-txt" id="progTxt">초기화 중...</div>
    </div>
    <div id="results"></div>
  </div>

  <!-- 인기 추천 탭 -->
  <div id="tabTrending" style="display:none">
    <div class="trhdr">
      <div class="trhdr-top">
        <div class="trtitle">🔥 <strong>인기 추천</strong> — 네이버 지식인·리뷰·검색량 기반 검증 키워드</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button class="fb on" onclick="trLang('all',this)">전체</button>
          <button class="fb" onclick="trLang('en',this)">🇺🇸 영어</button>
          <button class="fb" onclick="trLang('ko',this)">🇰🇷 한국어</button>
          <button class="exbtn" onclick="csvTr()">📥 CSV</button>
        </div>
      </div>
      <div class="catbar">
        <button class="catbtn on" onclick="trCat('all',this)">전체 카테고리</button>
        <button class="catbtn" onclick="trCat('건강/뷰티',this)">💊 건강/뷰티</button>
        <button class="catbtn" onclick="trCat('음식/요리',this)">🍜 음식/요리</button>
        <button class="catbtn" onclick="trCat('전자제품',this)">📱 전자제품</button>
        <button class="catbtn" onclick="trCat('한국여행',this)">✈️ 한국여행</button>
        <button class="catbtn" onclick="trCat('한국어학습',this)">📚 한국어학습</button>
        <button class="catbtn" onclick="trCat('주거/생활',this)">🏠 주거/생활</button>
      </div>
    </div>
    <div id="trendList"></div>
  </div>

  <!-- 시즌 탭 -->
  <div id="tabSeasonal" style="display:none">
    <div class="shdr">
      <div class="stday">오늘 기준 시즌 키워드 — <strong id="todayLbl"></strong></div>
      <span class="sbadge">📅 검증된 고트래픽 시즌 키워드 50개</span>
    </div>
    <div class="tbar" style="margin-bottom:14px">
      <button class="fb on" onclick="sfilt('all',this)">전체</button>
      <button class="fb" onclick="sfilt('cur',this)">🔥 이번달</button>
      <button class="fb" onclick="sfilt('en',this)">🇺🇸 영어</button>
      <button class="fb" onclick="sfilt('ko',this)">🇰🇷 한국어</button>
      <button class="exbtn" onclick="csvS()">📥 CSV</button>
    </div>
    <div id="seasonList"></div>
  </div>
</div>

<script>
const PROXY = '/api/proxy';
let allKw = [], seasonAll = [], trendAll = [], trCatSel = 'all', trLangSel = 'all';

// ── 씨드 생성 (브라우저에서 담당) ────────────────────────────────────────────
function buildSeeds(q, isKo) {
  const s = [q];
  if (isKo) {
    ["방법","추천","후기","가격","비교","장단점","꿀팁","종류","초보","무료","주의사항","신청","비용","차이"]
      .forEach(x => s.push(q+' '+x));
    ["가","나","다","라","마","바","사","아","자","차","카","타","파","하"]
      .forEach(x => s.push(q+' '+x));
  } else {
    ["how to","what is","best","guide","tips","for beginners","vs","review","2026","free","cheap","near me","without","alternative"]
      .forEach(x => s.push(q+' '+x));
    ["how to","how do","what is","where to","when to","why is","can i","should i"]
      .forEach(x => s.push(x+' '+q));
    "abcdefghijklmnopqrstuvwxyz".split("").forEach(x => s.push(q+' '+x));
  }
  return [...new Set(s)];
}

// ── 키워드 집계 맵 ────────────────────────────────────────────────────────────
const kwMap = new Map();
function addKw(kw, src) {
  if (!kw || kw.trim().length < 2) return;
  const key = kw.trim().toLowerCase();
  if (kwMap.has(key)) {
    const e = kwMap.get(key);
    if (!e.sources.includes(src)) { e.sources.push(src); e.score += src==='google'?3:src==='naver'?2:1; e.multiSource=true; }
  } else {
    kwMap.set(key, { keyword:kw.trim(), sources:[src], score:src==='google'?3:src==='naver'?2:1, wordCount:kw.trim().split(/\s+/).length, multiSource:false, isLongTail:kw.trim().split(/\s+/).length>=3 });
  }
}

function calcPot(k) {
  let s = k.score;
  if (k.multiSource)    s+=6;
  if (k.isLongTail)     s+=3;
  if (k.wordCount>=4)   s+=3;
  if (/how to|guide|best|tips|tutorial/.test(k.keyword)) s+=4;
  if (/방법|추천|가이드|후기|비교|하는법/.test(k.keyword))  s+=4;
  if (/2025|2026/.test(k.keyword))                       s+=2;
  if (/beginner|foreigner|초보|입문/.test(k.keyword))    s+=3;
  return s>=14?'HIGH':s>=8?'MED':'LOW';
}

function intent(kw) {
  const k=kw.toLowerCase();
  if (/buy|price|cost|cheap|free|가격|비용|얼마|무료/.test(k)) return '💰 구매/비용';
  if (/how to|guide|tutorial|방법|하는법|신청/.test(k))       return '📖 방법/가이드';
  if (/review|vs|compare|후기|비교|차이/.test(k))            return '⭐ 후기/비교';
  if (/beginner|start|basics|초보|입문|처음/.test(k))        return '🌱 입문/초보';
  return '📌 정보';
}

// ── 검색 실행 ─────────────────────────────────────────────────────────────────
async function search() {
  const q = document.getElementById('qi').value.trim();
  if (!q) { alert('키워드를 입력하세요'); return; }
  const isKo = /[ㄱ-ㅎ가-힣]/.test(q);
  const seeds = buildSeeds(q, isKo);
  kwMap.clear(); allKw = [];

  const btn = document.getElementById('sbtn');
  btn.disabled = true; btn.textContent = '⏳ 수집 중...';
  document.getElementById('results').innerHTML = '';
  const prog = document.getElementById('prog');
  prog.style.display = '';
  document.getElementById('progTotal').textContent = seeds.length * 3;

  let done = 0;
  const total = seeds.length * 3;

  function tick(src, seed) {
    done++;
    document.getElementById('progCount').textContent = done;
    document.getElementById('progBar').style.width = (done/total*100)+'%';
    document.getElementById('progTxt').textContent = src+': '+seed;
  }

  // 구글: 씨드별 순차 (Worker 프록시 경유)
  for (const seed of seeds) {
    try {
      const r = await fetch(PROXY+'?source=google&q='+encodeURIComponent(seed));
      const d = await r.json();
      (d.results||[]).forEach(k => addKw(k,'google'));
    } catch {}
    tick('Google', seed);
  }

  // 네이버 + 다음: 핵심 씨드만 병렬
  const coreSeedsKo = isKo ? [q,...["방법","추천","후기","가격","비교"].map(x=>q+' '+x)] : [q,...["how to","best","guide","tips","review"].map(x=>q+' '+x)];
  await Promise.allSettled(coreSeedsKo.map(async seed => {
    try {
      const r = await fetch(PROXY+'?source=naver&q='+encodeURIComponent(seed));
      const d = await r.json();
      (d.results||[]).forEach(k => addKw(k,'naver'));
    } catch {}
    tick('Naver', seed);
  }));
  await Promise.allSettled(coreSeedsKo.slice(0,4).map(async seed => {
    try {
      const r = await fetch(PROXY+'?source=daum&q='+encodeURIComponent(seed));
      const d = await r.json();
      (d.results||[]).forEach(k => addKw(k,'daum'));
    } catch {}
    tick('Daum', seed);
  }));

  prog.style.display = 'none';
  allKw = [...kwMap.values()]
    .filter(k => k.keyword.toLowerCase() !== q.toLowerCase())
    .map(k => ({ ...k, potential:calcPot(k), intent:intent(k.keyword) }))
    .sort((a,b) => b.score - a.score);

  renderResults(q);
  btn.disabled = false; btn.textContent = '🔍 키워드 발굴';
}

function renderResults(q) {
  if (!allKw.length) { document.getElementById('results').innerHTML='<div class="empty">결과 없음</div>'; return; }
  const high = allKw.filter(k=>k.potential==='HIGH').length;
  const google = allKw.filter(k=>k.sources.includes('google')).length;
  const naver  = allKw.filter(k=>k.sources.includes('naver')).length;
  const daum   = allKw.filter(k=>k.sources.includes('daum')).length;
  const multi  = allKw.filter(k=>k.multiSource).length;
  const lt     = allKw.filter(k=>k.isLongTail).length;

  document.getElementById('results').innerHTML =
    \`<div class="sum">
      <div class="sc"><div class="sn">\${allKw.length}</div><div class="sl">총 키워드</div></div>
      <div class="sc hi"><div class="sn">\${high}</div><div class="sl">HIGH</div></div>
      <div class="sc"><div class="sn">\${google}</div><div class="sl">Google</div></div>
      <div class="sc"><div class="sn">\${naver}</div><div class="sl">Naver</div></div>
      <div class="sc"><div class="sn">\${daum}</div><div class="sl">Daum</div></div>
      <div class="sc"><div class="sn">\${multi}</div><div class="sl">복수소스</div></div>
      <div class="sc"><div class="sn">\${lt}</div><div class="sl">롱테일</div></div>
    </div>
    <div class="tbar">
      <button class="fb on" onclick="filt('all',this)">전체</button>
      <button class="fb" onclick="filt('HIGH',this)">🟢 HIGH</button>
      <button class="fb" onclick="filt('MED',this)">🟡 MED</button>
      <button class="fb" onclick="filt('multi',this)">복수소스</button>
      <button class="fb" onclick="filt('longtail',this)">롱테일</button>
      <button class="fb" onclick="filt('google',this)">Google</button>
      <button class="fb" onclick="filt('naver',this)">Naver</button>
      <button class="fb" onclick="filt('daum',this)">Daum</button>
      <button class="exbtn" onclick="copyHigh()">⭐ HIGH복사</button>
      <button class="exbtn" onclick="csvKw()" style="margin-left:4px">📥 CSV</button>
    </div>
    <table class="kwtbl" id="kwTbl">
      <thead><tr><th>#</th><th>키워드</th><th>의도</th><th>소스</th><th>잠재력</th><th>복사</th></tr></thead>
      <tbody>\${rows(allKw)}</tbody>
    </table>\`;
}

function rows(kws) {
  return kws.map((k,i)=>\`<tr class="kwr">
    <td style="color:#334155;font-size:.75rem">\${i+1}</td>
    <td class="kwtxt">\${esc(k.keyword)}</td>
    <td class="intent">\${k.intent}</td>
    <td><div class="bgs">
      \${k.sources.includes('google')?'<span class="badge bg">G</span>':''}
      \${k.sources.includes('naver') ?'<span class="badge bn">N</span>':''}
      \${k.sources.includes('daum')  ?'<span class="badge bd">D</span>':''}
      \${k.isLongTail ?'<span class="badge bl">롱테일</span>':''}
      \${k.multiSource?'<span class="badge bm">복수</span>':''}
    </div></td>
    <td><span class="pot p\${k.potential[0]}">\${k.potential}</span></td>
    <td><button class="cpbtn" onclick="cp('\${esc(k.keyword)}',this)">복사</button></td>
  </tr>\`).join('');
}

function filt(t,btn) {
  document.querySelectorAll('#tabSearch .fb').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
  let f=allKw;
  if(t==='HIGH') f=allKw.filter(k=>k.potential==='HIGH');
  else if(t==='MED') f=allKw.filter(k=>k.potential==='MED');
  else if(t==='multi') f=allKw.filter(k=>k.multiSource);
  else if(t==='longtail') f=allKw.filter(k=>k.isLongTail);
  else if(t==='google') f=allKw.filter(k=>k.sources.includes('google'));
  else if(t==='naver')  f=allKw.filter(k=>k.sources.includes('naver'));
  else if(t==='daum')   f=allKw.filter(k=>k.sources.includes('daum'));
  document.querySelector('#kwTbl tbody').innerHTML=rows(f);
}

// ── 시즌 탭 ───────────────────────────────────────────────────────────────────
function switchTab(t,btn) {
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
  document.getElementById('tabSearch').style.display   = t==='search'   ?'':'none';
  document.getElementById('tabSeasonal').style.display = t==='seasonal' ?'':'none';
  document.getElementById('tabTrending').style.display = t==='trending' ?'':'none';
  if (t==='seasonal' && !seasonAll.length) loadSeasonal();
  if (t==='trending' && !trendAll.length) loadTrending();
}

async function loadSeasonal() {
  document.getElementById('seasonList').innerHTML='<div class="empty">⏳ 로딩 중...</div>';
  try {
    const d = await (await fetch('/api/seasonal')).json();
    seasonAll = d.keywords||[];
    const now = new Date();
    document.getElementById('todayLbl').textContent =
      now.getFullYear()+'년 '+(now.getMonth()+1)+'월 '+now.getDate()+'일';
    renderSeason(seasonAll);
  } catch { document.getElementById('seasonList').innerHTML='<div class="empty">❌ 오류</div>'; }
}

function renderSeason(kws) {
  document.getElementById('seasonList').innerHTML = kws.map((k,i)=>\`
    <div class="scard">
      <span class="srank">\${i+1}</span>
      <span class="skw">\${esc(k.keyword)}</span>
      <span class="slang \${k.lang==='en'?'len':'lko'}">\${k.lang.toUpperCase()}</span>
      <span class="smo \${k.isCurrentMonth?'cur':'oth'}">\${k.monthLabel}</span>
      <button class="cpbtn" onclick="cp('\${esc(k.keyword)}',this)">복사</button>
    </div>\`).join('');
}

function sfilt(t,btn) {
  document.querySelectorAll('#tabSeasonal .fb').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
  let f=seasonAll;
  if(t==='cur') f=seasonAll.filter(k=>k.isCurrentMonth);
  else if(t==='en') f=seasonAll.filter(k=>k.lang==='en');
  else if(t==='ko') f=seasonAll.filter(k=>k.lang==='ko');
  renderSeason(f);
}

// ── 인기 추천 탭 ──────────────────────────────────────────────────────────────
async function loadTrending() {
  document.getElementById('trendList').innerHTML='<div class="empty">⏳ 로딩 중...</div>';
  try {
    const d = await (await fetch('/api/trending')).json();
    trendAll = d.keywords||[];
    renderTrending();
  } catch { document.getElementById('trendList').innerHTML='<div class="empty">❌ 오류</div>'; }
}

function renderTrending() {
  let f = trendAll;
  if (trCatSel !== 'all') f = f.filter(k=>k.cat===trCatSel);
  if (trLangSel !== 'all') f = f.filter(k=>k.lang===trLangSel);
  if (!f.length) { document.getElementById('trendList').innerHTML='<div class="empty">결과 없음</div>'; return; }
  document.getElementById('trendList').innerHTML = f.map((k,i)=>\`
    <div class="trcard">
      <span style="color:#334155;font-size:.75rem;width:26px;text-align:center;flex-shrink:0">\${i+1}</span>
      <span class="trcat">\${k.cat}</span>
      <span class="trkw">\${esc(k.keyword)}</span>
      <span class="slang \${k.lang==='en'?'len':'lko'}" style="flex-shrink:0">\${k.lang.toUpperCase()}</span>
      <span class="intent" style="font-size:.72rem;flex-shrink:0">\${k.intent}</span>
      <div class="tagsrow" style="flex-shrink:0">\${(k.tags||[]).map(t=>\`<span class="trtag">\${t}</span>\`).join('')}</div>
      <button class="cpbtn" onclick="cp('\${esc(k.keyword)}',this)">복사</button>
    </div>\`).join('');
}

function trCat(c,btn) {
  trCatSel=c;
  document.querySelectorAll('.catbtn').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
  renderTrending();
}
function trLang(l,btn) {
  trLangSel=l;
  document.querySelectorAll('#tabTrending .fb').forEach(b=>b.classList.remove('on')); btn.classList.add('on');
  renderTrending();
}
function csvTr() {
  let f=trendAll;
  if(trCatSel!=='all') f=f.filter(k=>k.cat===trCatSel);
  if(trLangSel!=='all') f=f.filter(k=>k.lang===trLangSel);
  exportCsv(f.map(k=>[k.keyword,k.cat,k.lang,k.intent,(k.tags||[]).join('|'),'HIGH']),['키워드','카테고리','언어','의도','태그','잠재력'],'trending.csv');
}

// ── 공통 유틸 ─────────────────────────────────────────────────────────────────
function cp(t,btn){ navigator.clipboard.writeText(t).then(()=>{btn.textContent='✓';setTimeout(()=>btn.textContent='복사',1400);}); }
function copyHigh(){ const h=allKw.filter(k=>k.potential==='HIGH').map(k=>k.keyword).join('\\n'); navigator.clipboard.writeText(h).then(()=>alert('HIGH '+allKw.filter(k=>k.potential==='HIGH').length+'개 복사!')); }
function csvKw(){ exportCsv(allKw.map(k=>[k.keyword,k.sources.join('+'),k.intent,k.potential,k.isLongTail?'Y':'N',k.multiSource?'Y':'N']), ['키워드','소스','의도','잠재력','롱테일','복수소스'], 'keywords.csv'); }
function csvS(){ exportCsv(seasonAll.map(k=>[k.rank,k.keyword,k.lang,k.monthLabel,k.potential]), ['순위','키워드','언어','월','잠재력'], 'seasonal.csv'); }
function exportCsv(data, headers, name){ const rows=[headers,...data]; const c=rows.map(r=>r.map(v=>\`"\${v}"\`).join(',')).join('\\n'); const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['\\uFEFF'+c],{type:'text/csv;charset=utf-8'})); a.download=name; a.click(); }
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
document.getElementById('qi').addEventListener('keydown', e=>{ if(e.key==='Enter') search(); });
</script>
</body>
</html>`;
}
