import anthropic
import requests
import os
import random
import re
from datetime import datetime

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
BICHON_API_KEY = os.environ["BICHON_API_KEY"].strip()
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY", "").strip()
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "").strip()

TOPICS = [
    ("혈압 관리에 좋은 음식 TOP 5", "건강관리", "blood pressure healthy food"),
    ("하루 30분 걷기의 놀라운 건강 효과", "건강생활", "walking exercise health"),
    ("면역력 높이는 생활습관 7가지", "건강", "immune system healthy lifestyle"),
    ("시니어를 위한 근력 운동 완전 가이드", "시니어건강", "senior exercise strength"),
    ("수면의 질을 높이는 10가지 방법", "건강생활", "sleep quality healthy"),
    ("당뇨 예방을 위한 식단 관리법", "건강관리", "diabetes prevention diet"),
    ("무릎 통증 완화 스트레칭 루틴", "건강", "knee pain stretching exercise"),
    ("장 건강을 위한 프로바이오틱스 완벽 가이드", "건강식품", "probiotics gut health food"),
    ("비타민D 결핍 증상과 올바른 보충 방법", "건강식품", "vitamin D supplement health"),
    ("스트레스 해소에 효과적인 음식과 습관", "건강생활", "stress relief healthy food"),
    ("고혈압 환자를 위한 저염식 식단 가이드", "건강관리", "low sodium diet healthy"),
    ("치매 예방을 위한 두뇌 건강 관리법", "시니어건강", "dementia prevention brain health"),
    ("오메가3 효능과 올바른 섭취법 완벽 정리", "건강식품", "omega 3 fish oil supplement"),
    ("골다공증 예방을 위한 운동과 식품", "시니어건강", "osteoporosis prevention calcium"),
    ("다이어트 중 근육 유지하는 방법", "건강다이어트", "diet muscle maintenance exercise"),
    ("공복 혈당 낮추는 생활 습관", "건강관리", "blood sugar fasting healthy"),
    ("눈 건강을 지키는 루테인 섭취법", "건강식품", "eye health lutein supplement"),
    ("만성 피로 회복에 좋은 영양소와 음식", "건강", "fatigue recovery nutrition food"),
    ("관절 건강을 위한 콜라겐 완벽 가이드", "건강백세", "joint health collagen supplement"),
    ("항산화 식품으로 노화 늦추는 법", "건강백세", "antioxidant food anti aging"),
    ("간 건강을 지키는 생활 습관과 음식", "건강관리", "liver health food lifestyle"),
    ("갱년기 증상 완화를 위한 건강 관리", "시니어건강", "menopause health management"),
    ("단백질 식품 TOP 10 완벽 정리", "건강다이어트", "protein food diet health"),
    ("혈액순환 개선을 위한 운동과 음식", "건강생활", "blood circulation exercise food"),
    ("아침 식사의 중요성과 건강한 아침 메뉴", "건강생활", "healthy breakfast morning food"),
]

topic, category, image_query = random.choice(TOPICS)


FALLBACK_IMAGES = {
    "건강":          "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
    "건강관리":      "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg",
    "건강생활":      "https://images.pexels.com/photos/317157/pexels-photo-317157.jpeg",
    "시니어건강":    "https://images.pexels.com/photos/3768131/pexels-photo-3768131.jpeg",
    "건강식품":      "https://images.pexels.com/photos/1028599/pexels-photo-1028599.jpeg",
    "건강다이어트":  "https://images.pexels.com/photos/2377045/pexels-photo-2377045.jpeg",
    "건강백세":      "https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg",
}


def get_image_url(query, category="건강"):
    print(f"PEXELS_API_KEY 길이: {len(PEXELS_API_KEY)}")
    if PEXELS_API_KEY:
        try:
            print(f"Pexels 검색: {query}")
            resp = requests.get(
                "https://api.pexels.com/v1/search",
                headers={"Authorization": PEXELS_API_KEY},
                params={"query": query, "per_page": 10, "orientation": "landscape"},
                timeout=10
            )
            print(f"Pexels 응답 코드: {resp.status_code}")
            data = resp.json()
            photos = data.get("photos", [])
            print(f"이미지 수: {len(photos)}")
            if photos:
                photo = random.choice(photos[:5])
                url = photo["src"]["large2x"]
                print(f"선택된 이미지: {url[:60]}...")
                return url
            else:
                print(f"이미지 없음. 응답: {str(data)[:200]}")
        except Exception as e:
            print(f"Pexels 실패: {e}")

    # 기본 이미지 사용
    fallback = FALLBACK_IMAGES.get(category, FALLBACK_IMAGES["건강"])
    print(f"기본 이미지 사용: {fallback[:60]}...")
    return fallback


def search_references(topic):
    """Tavily로 신뢰할 수 있는 자료 검색"""
    if not TAVILY_API_KEY:
        print("TAVILY_API_KEY 없음 - 검색 스킵")
        return ""
    try:
        print(f"자료 검색 중: {topic}")
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": f"{topic} 연구 논문 전문가 영양사 의학적 효과",
                "search_depth": "advanced",
                "max_results": 5,
                "include_domains": [
                    "pubmed.ncbi.nlm.nih.gov",
                    "health.harvard.edu",
                    "ncbi.nlm.nih.gov",
                    "who.int",
                    "mayoclinic.org",
                    "nhs.uk",
                    "korea.kr",
                    "kdca.go.kr",
                    "health.kr"
                ]
            },
            timeout=15
        )
        data = resp.json()
        results = data.get("results", [])
        if not results:
            # 도메인 제한 없이 재시도
            resp2 = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": f"{topic} 영양사 교수 연구결과 효능 효과",
                    "search_depth": "advanced",
                    "max_results": 5,
                },
                timeout=15
            )
            data = resp2.json()
            results = data.get("results", [])

        ref_text = ""
        for r in results[:4]:
            ref_text += f"\n출처: {r.get('title','')}\nURL: {r.get('url','')}\n내용: {r.get('content','')[:500]}\n"
        print(f"검색 결과 {len(results)}개 수집")
        return ref_text
    except Exception as e:
        print(f"검색 실패: {e}")
        return ""


def generate_post(topic, references="", body_image=""):
    ref_section = f"""
[참고 자료 - 아래 내용을 바탕으로 신뢰도 높은 글을 작성하세요]
{references}
""" if references else ""

    body_image_instruction = f"""
- 본문 중간(두 번째 또는 세 번째 h2 섹션 직후)에 아래 이미지를 반드시 삽입하세요:
  <figure style="margin:1.8rem 0">
    <img src="{body_image}" alt="[주제와 관련된 구체적인 설명으로 채워주세요]" style="width:100%;border-radius:12px">
    <figcaption style="text-align:center;font-size:.8rem;color:#86868b;margin-top:6px">[이미지 설명 1줄]</figcaption>
  </figure>
  (alt 속성에는 "이미지" 같은 단어 대신 해당 섹션 내용을 설명하는 구체적인 한국어 문장을 넣으세요)""" if body_image else ""

    prompt = f"""당신은 영양학 석사 학위를 보유한 10년 경력의 건강 전문 블로거입니다.
논문, 의학 연구, 공신력 있는 전문가(영양사, 의사, 교수)의 견해를 바탕으로 아래 주제의 고품질 블로그 포스트를 작성해주세요.

주제: {topic}
{ref_section}
[작성 규칙]
- HTML 형식 (h2, h3, p, ul, li, strong, blockquote, table 태그 적극 활용)
- 분량: 1800~2500단어
- 구성:
  1. 흥미로운 도입부 (통계나 연구 수치로 시작)
  2. 핵심 내용 5개 섹션 (각 섹션마다 h2 태그)
  3. 각 섹션에 연구 결과, 전문가 의견, 구체적 수치 포함
  4. blockquote 태그로 전문가 인용구 1~2개 삽입
  5. 실천 가능한 팁을 bullet point로 정리
  6. 마무리 (핵심 요약 + 독자 행동 유도)
- "연구에 따르면", "전문가들은", "○○ 대학 연구팀", "대한영양사협회" 등 출처 명시
- 의학적 면책 조항을 마지막에 추가
- 친근하고 신뢰감 있는 문체
- SEO를 위해 주제 키워드를 자연스럽게 반복

[SEO 필수 규칙 - 반드시 준수]
1. 첫 번째 <p> 태그의 첫 문장에 제목의 핵심 키워드를 자연스럽게 포함하세요.
   예) 주제가 "혈압 낮추는 법"이면 → "혈압을 낮추는 방법을 찾고 계신가요? ..."
2. 링크(<a> 태그)를 사용할 때는 반드시 설명적인 앵커 텍스트를 사용하세요.
   금지: <a href="...">여기</a>, <a href="...">클릭</a>
   권장: <a href="...">혈압 낮추는 DASH 식단 자세히 보기</a>
{body_image_instruction}

아래 형식으로만 응답하세요. 마크다운 코드블록(```)을 절대 사용하지 마세요:
TITLE: (매력적인 제목, 숫자나 효과를 포함)
EXCERPT: (80~120자 요약, 검색 결과에 표시될 문장)
KEYWORDS: (SEO 키워드 5~7개, 쉼표 구분)
CONTENT: (HTML 본문 전체, 코드블록 없이 HTML 태그만 사용)"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text
    lines = response_text.split("\n")

    title = topic
    excerpt = ""
    keywords = ""
    content_lines = []
    content_started = False

    for line in lines:
        if line.startswith("TITLE:"):
            title = line.replace("TITLE:", "").strip()
        elif line.startswith("EXCERPT:"):
            excerpt = line.replace("EXCERPT:", "").strip()
        elif line.startswith("KEYWORDS:"):
            keywords = line.replace("KEYWORDS:", "").strip()
        elif line.startswith("CONTENT:"):
            content_started = True
            rest = line.replace("CONTENT:", "").strip()
            if rest:
                content_lines.append(rest)
        elif content_started:
            content_lines.append(line)

    content = "\n".join(content_lines).strip()
    if not content:
        content = response_text

    # 마크다운 코드블록 제거: ```html ... ``` 또는 ``` ... ```
    content = re.sub(r'^```[a-zA-Z]*\s*', '', content)
    content = re.sub(r'\s*```\s*$', '', content)
    content = content.strip()

    return title, excerpt, keywords, content


def make_slug(title):
    """한글 제목을 영문 slug로 변환 (간단한 방식)"""
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[\s_-]+', '-', slug).strip('-')
    # 한글이 포함된 경우 타임스탬프 기반 slug 사용
    if re.search(r'[^\x00-\x7F]', slug):
        slug = f"post-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    return slug or f"post-{datetime.now().strftime('%Y%m%d%H%M%S')}"


def build_full_html(title, excerpt, keywords, content, category, thumbnail, slug, pub_date):
    """SEO-optimized 완전한 HTML 페이지 생성"""
    canonical_url = f"https://bichonbuff.com/{slug}.html"
    og_image = f'<meta property="og:image" content="{thumbnail}">' if thumbnail else ""
    thumb_html = f'<img class="post-thumb" src="{thumbnail}" alt="{title}">' if thumbnail else ""

    # 날짜 포맷 (표시용)
    try:
        d = datetime.strptime(pub_date, "%Y-%m-%d")
        date_display = f"{d.year}년 {d.month}월 {d.day}일"
    except Exception:
        date_display = pub_date

    json_ld = f"""  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": {repr(title)},
    "description": {repr(excerpt)},
    "datePublished": "{pub_date}",
    "dateModified": "{pub_date}",
    "author": {{"@type": "Organization", "name": "비숑 웰니스", "url": "https://bichonbuff.com/"}},
    "publisher": {{"@type": "Organization", "name": "비숑 웰니스", "url": "https://bichonbuff.com/"}},
    "mainEntityOfPage": {{"@type": "WebPage", "@id": "{canonical_url}"}},
    {f'"image": "{thumbnail}",' if thumbnail else ""}
    "inLanguage": "ko",
    "keywords": {repr(keywords)}
  }}
  </script>"""

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="google-adsense-account" content="ca-pub-3425189666333844">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | 비숑 웰니스</title>
  <meta name="description" content="{excerpt}">
  <meta name="keywords" content="{keywords}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{excerpt}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="{canonical_url}">
  <meta property="og:site_name" content="비숑 웰니스">
  {og_image}
  <link rel="canonical" href="{canonical_url}">
{json_ld}
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3425189666333844" crossorigin="anonymous"></script>
  <style>
    :root{{--bg:#fff;--bg2:#f5f5f7;--line2:#e8e8eb;--muted:#86868b;--txt:#1d1d1f;--accent:#0071e3}}
    *{{box-sizing:border-box}}
    body{{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',system-ui,sans-serif;background:var(--bg);color:var(--txt);-webkit-font-smoothing:antialiased}}
    .header{{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}}
    .header-in{{max-width:1200px;margin:0 auto;padding:13px 28px;display:flex;justify-content:space-between;align-items:center}}
    .brand{{font-weight:800;font-size:1.15rem;letter-spacing:-.03em;color:var(--txt);text-decoration:none}}
    .nav{{display:flex;gap:20px;align-items:center}}
    .nav a{{color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:500;transition:color .15s}}
    .nav a:hover{{color:var(--txt)}}
    .post-wrap{{max-width:760px;margin:0 auto;padding:48px 24px 80px}}
    .back-btn{{display:inline-flex;align-items:center;gap:6px;font-size:.85rem;font-weight:600;color:var(--muted);text-decoration:none;margin-bottom:28px;transition:color .15s}}
    .back-btn:hover{{color:var(--txt)}}
    .post-cat{{display:inline-block;font-size:.75rem;font-weight:700;color:var(--accent);background:rgba(0,113,227,.08);padding:4px 10px;border-radius:20px;margin-bottom:16px}}
    .post-title{{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:800;letter-spacing:-.04em;line-height:1.3;margin:0 0 14px}}
    .post-meta{{font-size:.8rem;color:var(--muted);margin-bottom:32px}}
    .post-thumb{{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:16px;margin-bottom:36px;display:block;background:var(--bg2)}}
    .post-body{{line-height:1.9;font-size:1rem;color:#2d2d2f}}
    .post-body h2{{font-size:1.3rem;font-weight:700;letter-spacing:-.03em;margin:2.8rem 0 1rem;color:var(--txt);padding-bottom:.5rem;border-bottom:1px solid var(--line2)}}
    .post-body h3{{font-size:1.05rem;font-weight:700;margin:1.8rem 0 .7rem;color:var(--txt)}}
    .post-body p{{margin:0 0 1.2rem}}
    .post-body ul,.post-body ol{{padding-left:1.5rem;margin:0 0 1.2rem}}
    .post-body li{{margin-bottom:.6rem}}
    .post-body strong{{color:var(--txt)}}
    .post-body a{{color:var(--accent);text-decoration:none}}
    .post-body a:hover{{text-decoration:underline}}
    .post-body img{{max-width:100%;border-radius:12px;margin:1rem 0}}
    .post-body table{{width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:.9rem}}
    .post-body th,.post-body td{{padding:10px 14px;border:1px solid var(--line2);text-align:left}}
    .post-body th{{background:var(--bg2);font-weight:700}}
    .callout{{background:rgba(0,113,227,.06);border-left:3px solid var(--accent);padding:1rem 1.2rem;border-radius:0 8px 8px 0;margin:1.5rem 0}}
    .callout p{{margin:0}}
    .warning{{background:rgba(255,149,0,.07);border-left:3px solid #ff9500;padding:1rem 1.2rem;border-radius:0 8px 8px 0;margin:1.5rem 0}}
    .warning p{{margin:0}}
    footer{{text-align:center;padding:24px 20px;margin-top:60px;border-top:1px solid var(--line2);font-size:.8rem;color:var(--muted)}}
    footer a{{color:inherit;text-decoration:none;margin:0 10px}}
    footer a:hover{{text-decoration:underline}}
    .footer-copy{{margin-top:8px;font-size:.75rem}}
    @media(max-width:600px){{.post-wrap{{padding:28px 16px 60px}}}}
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
      <a href="lotto.html">로또 생성기</a>
    </nav>
  </div>
</header>

<div class="post-wrap">
  <a href="index.html" class="back-btn">← 목록으로</a>
  <span class="post-cat">{category}</span>
  <h1 class="post-title">{title}</h1>
  <div class="post-meta">{date_display} · {category}</div>

  {thumb_html}

  <div class="post-body">
{content}
  </div>
</div>

<footer>
  <a href="privacy.html">개인정보 처리방침</a> |
  <a href="terms.html">이용약관</a> |
  <a href="contact.html">문의하기</a>
  <div class="footer-copy">© 2026 비숑 웰니스. All rights reserved.</div>
</footer>
</body>
</html>"""


print(f"주제: {topic}")
print("자료 검색 중...")
references = search_references(topic)

print("이미지 검색 중...")
thumbnail = get_image_url(image_query, category)
if thumbnail:
    print(f"썸네일 URL: {thumbnail[:60]}...")
else:
    print("썸네일 없이 진행")

# 본문용 이미지 — 썸네일과 다른 결과를 얻기 위해 쿼리 변형
body_image = get_image_url(image_query + " lifestyle", category)
if body_image == thumbnail:
    body_image = get_image_url(image_query + " healthy food", category)
print(f"본문 이미지 URL: {body_image[:60] if body_image else '없음'}...")

print("글 생성 중...")
title, excerpt, keywords, content = generate_post(topic, references, body_image)

pub_date = datetime.now().strftime("%Y-%m-%d")
slug = make_slug(title)
full_html = build_full_html(title, excerpt, keywords, content, category, thumbnail, slug, pub_date)

payload = {
    "title": title,
    "excerpt": excerpt,
    "keywords": keywords,
    "content": content,
    "html": full_html,
    "category": category,
    "status": "published",
    "thumbnail": thumbnail,
    "date": pub_date,
    "slug": slug,
}

resp = requests.post(
    "https://bichonbuff.com/api/posts",
    json=payload,
    headers={"X-API-Key": BICHON_API_KEY, "Content-Type": "application/json"}
)

result = resp.json()
if result.get("success"):
    print(f"✅ 포스팅 완료: {result['post']['title']} (slug: {result['post']['slug']})")
else:
    print(f"❌ 실패: {result}")
    exit(1)
