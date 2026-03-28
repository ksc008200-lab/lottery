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
    # 건강
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
    # 건강 추가
    ("갱년기 여성을 위한 호르몬 균형 식단", "건강관리", "menopause diet hormone balance"),
    ("50대 이후 꼭 받아야 할 건강검진 항목", "시니어건강", "health checkup over 50 senior"),
    ("신장 건강을 지키는 생활 습관과 음식", "건강관리", "kidney health food lifestyle"),
    ("심장 건강을 위한 유산소 운동 가이드", "건강생활", "heart health cardio exercise"),
    ("염증을 줄이는 항염 식단 완벽 가이드", "건강식품", "anti inflammatory diet food"),
    ("장누수증후군 원인과 치유 식단", "건강관리", "leaky gut syndrome diet heal"),
    ("수족냉증 개선에 좋은 음식과 운동", "건강", "cold hands feet circulation remedy"),
    ("허리 통증 줄이는 코어 운동 루틴", "건강생활", "back pain core exercise routine"),
    ("고지혈증 낮추는 식습관 7가지", "건강관리", "high cholesterol diet lifestyle"),
    ("갑상선 건강을 위한 식품과 생활 습관", "건강관리", "thyroid health food lifestyle"),
    ("뇌 건강을 지키는 슈퍼푸드 TOP 10", "건강식품", "brain health superfood nutrition"),
    ("불면증 극복을 위한 수면 루틴과 음식", "건강생활", "insomnia sleep routine food"),
    ("피로 회복에 좋은 비타민과 미네랄 총정리", "건강식품", "fatigue vitamins minerals supplement"),
    ("노화 방지를 위한 항산화 생활 습관", "건강백세", "anti aging antioxidant lifestyle"),
]

# 속보뉴스 비율: 애드센스 승인 전까지 비활성화
USE_NEWS = False  # 승인 후 활성화: TAVILY_API_KEY and random.random() < 0.30
topic, category, image_query = random.choice(TOPICS)


FALLBACK_IMAGES = {
    "건강":          "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg",
    "건강관리":      "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg",
    "건강생활":      "https://images.pexels.com/photos/317157/pexels-photo-317157.jpeg",
    "시니어건강":    "https://images.pexels.com/photos/3768131/pexels-photo-3768131.jpeg",
    "건강식품":      "https://images.pexels.com/photos/1028599/pexels-photo-1028599.jpeg",
    "건강다이어트":  "https://images.pexels.com/photos/2377045/pexels-photo-2377045.jpeg",
    "건강백세":      "https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg",
    "재테크":        "https://images.pexels.com/photos/6801648/pexels-photo-6801648.jpeg",
    "생활정보":      "https://images.pexels.com/photos/4386321/pexels-photo-4386321.jpeg",
    "멘탈헬스":      "https://images.pexels.com/photos/3759657/pexels-photo-3759657.jpeg",
    "반려동물":      "https://images.pexels.com/photos/1805164/pexels-photo-1805164.jpeg",
    "뷰티건강":      "https://images.pexels.com/photos/3762875/pexels-photo-3762875.jpeg",
    "속보뉴스":      "https://images.pexels.com/photos/518543/pexels-photo-518543.jpeg",
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


def fetch_breaking_news():
    """Tavily로 오늘의 한국 주요 뉴스 검색"""
    if not TAVILY_API_KEY:
        return None
    try:
        print("속보뉴스 검색 중...")
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": "오늘 한국 주요 뉴스 속보 이슈",
                "search_depth": "basic",
                "max_results": 5,
                "days": 1,
            },
            timeout=15
        )
        results = resp.json().get("results", [])
        if not results:
            # 폴백: 최근 2일
            resp2 = requests.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": "한국 주요 뉴스 이슈 최신",
                    "search_depth": "basic",
                    "max_results": 5,
                    "days": 2,
                },
                timeout=15
            )
            results = resp2.json().get("results", [])
        if not results:
            return None
        # 가장 관련성 높은 뉴스 선택
        top = results[0]
        news_items = []
        for r in results[:5]:
            news_items.append({
                "title": r.get("title", ""),
                "content": r.get("content", "")[:600],
                "url": r.get("url", ""),
            })
        print(f"뉴스 {len(news_items)}건 수집: {top.get('title', '')[:50]}")
        return news_items
    except Exception as e:
        print(f"뉴스 검색 실패: {e}")
        return None


def generate_news_post(news_items):
    """속보뉴스 기반 포스팅 생성"""
    news_text = ""
    for i, n in enumerate(news_items, 1):
        news_text += f"\n[뉴스 {i}]\n제목: {n['title']}\n내용: {n['content']}\n"

    prompt = f"""당신은 시사·생활 정보를 알기 쉽게 전달하는 블로거입니다.
아래 오늘의 주요 뉴스를 바탕으로 독자들이 꼭 알아야 할 핵심 내용을 정리해 주세요.

[오늘의 뉴스 자료]
{news_text}

[작성 규칙]
- HTML 형식 (h2, h3, p, ul, li, strong, blockquote 태그 활용)
- 분량: 1200~1800단어
- 구성:
  1. 오늘의 주요 이슈 요약 (도입부 — 왜 중요한지 설명)
  2. 핵심 내용 3~4개 섹션 (각 h2 태그)
  3. 독자에게 미치는 영향 / 생활 속 대응법
  4. 마무리 (핵심 요약)
- 출처는 직접 URL 노출 금지, 내용만 자연스럽게 반영
- 친근하고 이해하기 쉬운 문체
- SEO를 위해 핵심 키워드 자연스럽게 반복
- 뉴스가 여러 개면 가장 영향력 있는 1~2개를 중심으로 작성

아래 형식으로만 응답하세요. 마크다운 코드블록(```)을 절대 사용하지 마세요:
TITLE: (오늘의 이슈를 담은 매력적인 제목)
EXCERPT: (80~120자 요약)
KEYWORDS: (SEO 키워드 5~7개, 쉼표 구분)
CONTENT: (HTML 본문 전체)"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=6000,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text
    lines = response_text.split("\n")
    title = "오늘의 주요 뉴스 정리"
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
    content = re.sub(r'^```[a-zA-Z]*\s*', '', content)
    content = re.sub(r'\s*```\s*$', '', content)
    return title, excerpt, keywords, content.strip()


def search_personal_experiences(topic):
    """블로그/유튜브/네이버카페 실제 체험담 검색"""
    if not TAVILY_API_KEY:
        return ""
    try:
        print(f"개인 체험 검색 중: {topic}")
        queries = [
            f"{topic} 후기 블로그 직접 해봤어요 체험",
            f"{topic} 네이버카페 실제 경험 솔직 후기",
            f"{topic} 유튜브 실천 일상 변화 경험담",
        ]
        all_results = []
        for q in queries[:2]:
            try:
                resp = requests.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": TAVILY_API_KEY,
                        "query": q,
                        "search_depth": "basic",
                        "max_results": 3,
                        "include_domains": [
                            "blog.naver.com",
                            "cafe.naver.com",
                            "tistory.com",
                            "brunch.co.kr",
                            "youtube.com",
                            "instagram.com",
                            "m.blog.naver.com",
                        ]
                    },
                    timeout=12
                )
                results = resp.json().get("results", [])
                all_results.extend(results)
            except Exception:
                pass

        if not all_results:
            # 도메인 제한 없이 재시도
            try:
                resp = requests.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": TAVILY_API_KEY,
                        "query": f"{topic} 솔직후기 직접해봤어요 일상 변화",
                        "search_depth": "basic",
                        "max_results": 4,
                    },
                    timeout=12
                )
                all_results = resp.json().get("results", [])
            except Exception:
                pass

        exp_text = ""
        for r in all_results[:4]:
            content = r.get("content", "")[:400]
            exp_text += f"\n[체험 출처: {r.get('title','')}]\n{content}\n"
        print(f"체험 검색 결과 {len(all_results)}개 수집")
        return exp_text
    except Exception as e:
        print(f"체험 검색 실패: {e}")
        return ""


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


def generate_post(topic, references="", body_image="", experiences=""):
    ref_section = f"""
[참고 자료 - 아래 내용을 바탕으로 신뢰도 높은 글을 작성하세요]
{references}
""" if references else ""

    exp_section = f"""
[실제 체험담 자료 - 블로그/카페/유튜브에서 수집한 실제 경험들]
{experiences}
""" if experiences else ""

    body_image_instruction = f"""
- 본문 중간(두 번째 또는 세 번째 h2 섹션 직후)에 아래 이미지를 반드시 삽입하세요:
  <figure style="margin:1.8rem 0">
    <img src="{body_image}" alt="[주제와 관련된 구체적인 설명으로 채워주세요]" style="width:100%;border-radius:12px">
    <figcaption style="text-align:center;font-size:.8rem;color:#86868b;margin-top:6px">[이미지 설명 1줄]</figcaption>
  </figure>
  (alt 속성에는 "이미지" 같은 단어 대신 해당 섹션 내용을 설명하는 구체적인 한국어 문장을 넣으세요)""" if body_image else ""

    prompt = f"""당신은 건강한 생활을 10년째 직접 실천하며 블로그를 운영 중인 건강 전문 블로거입니다.
영양학 지식과 함께 본인의 직접 체험, 주변 사람들의 경험을 자연스럽게 녹여 글을 씁니다.

주제: {topic}
{ref_section}{exp_section}
[작성 규칙]
- HTML 형식 (h2, h3, p, ul, li, strong, blockquote, table 태그 적극 활용)
- 분량: 1800~2500단어
- 구성:
  1. 개인적인 경험이나 주변 사례로 시작하는 도입부 (통계/연구 수치 포함)
  2. 핵심 내용 5개 섹션 (각 섹션마다 h2 태그)
  3. 각 섹션에 연구 결과, 전문가 의견, 구체적 수치 포함
  4. blockquote 태그로 전문가 인용구 또는 실제 후기 1~2개 삽입
  5. 실천 가능한 팁을 bullet point로 정리
  6. 마무리 (핵심 요약 + 독자 행동 유도)
- "연구에 따르면", "전문가들은", "○○ 대학 연구팀" 등 출처 명시
- 위에 제공된 [실제 체험담 자료]를 참고하여, 블로거 본인 또는 독자들의 실제 경험처럼 자연스럽게 1~2곳에 녹여주세요.
  예) "저도 3개월 전부터 직접 해봤는데...", "카페에서 많은 분들이 비슷한 경험을 나눠주셨어요..."
  단, 출처 URL은 노출하지 말고 내용만 자연스럽게 반영하세요.
- 의학적 면책 조항을 마지막에 추가
- 친근하고 공감가는 문체 (너무 딱딱하지 않게)
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
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Noto Sans KR',system-ui,sans-serif;background:#f8f8fa;color:var(--txt);-webkit-font-smoothing:antialiased}}

    /* ── 헤더 ── */
    .header{{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.92);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}}
    .header-in{{max-width:1280px;margin:0 auto;padding:13px 28px;display:flex;justify-content:space-between;align-items:center}}
    .brand{{font-weight:800;font-size:1.15rem;letter-spacing:-.03em;color:var(--txt);text-decoration:none}}
    .nav{{display:flex;gap:20px}}
    .nav a{{color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:500;transition:color .15s}}
    .nav a:hover{{color:var(--txt)}}

    /* ── 상단 카테고리/도구 바 ── */
    .topbar{{background:#fff;border-bottom:1px solid var(--line2);overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}}
    .topbar::-webkit-scrollbar{{display:none}}
    .topbar-in{{max-width:1280px;margin:0 auto;padding:0 20px;display:flex;align-items:stretch;white-space:nowrap}}
    .topbar-group{{display:flex;align-items:center}}
    .topbar-label{{font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px;white-space:nowrap}}
    .topbar-group a{{display:inline-flex;align-items:center;gap:4px;padding:9px 12px;font-size:.8rem;color:var(--muted);text-decoration:none;font-weight:500;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap}}
    .topbar-group a:hover{{color:var(--accent);border-bottom-color:var(--accent)}}
    .topbar-div{{width:1px;background:var(--line2);margin:8px 4px;align-self:stretch}}

    /* ── 카테고리 상단 바 ── */
    .cat-bar{{background:#fff;border-bottom:1px solid var(--line2);padding:10px 0}}
    .cat-bar-in{{max-width:1280px;margin:0 auto;padding:0 28px;display:flex;align-items:center;gap:10px;font-size:.82rem;color:var(--muted)}}
    .cat-bar a{{color:var(--muted);text-decoration:none}}
    .cat-bar a:hover{{color:var(--accent)}}
    .cat-bar .sep{{opacity:.4}}
    .cat-bar .current{{color:var(--accent);font-weight:700}}

    /* ── 3컬럼 메인 그리드 ── */
    .page-grid{{max-width:1280px;margin:0 auto;padding:28px 16px 60px;display:grid;grid-template-columns:160px 1fr 240px;gap:24px;align-items:start}}

    /* ── 좌측 광고 컬럼 ── */
    .col-left{{position:sticky;top:80px}}
    .v-ad{{background:#fff;border-radius:12px;border:1px solid var(--line2);overflow:hidden;min-height:600px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:8px 0}}
    .v-ad-label{{font-size:.62rem;color:#ccc;letter-spacing:.08em;text-transform:uppercase;padding:6px 0 4px}}

    /* ── 중앙 본문 컬럼 ── */
    .col-main{{min-width:0}}
    .post-card{{background:#fff;border-radius:16px;border:1px solid var(--line2);overflow:hidden;padding:32px 36px 40px}}

    /* ── 포스트 헤더 ── */
    .post-cat{{display:inline-block;font-size:.72rem;font-weight:700;color:var(--accent);background:rgba(0,113,227,.08);padding:3px 10px;border-radius:20px;margin-bottom:14px}}
    .post-title{{font-size:clamp(1.55rem,3.5vw,2.1rem);font-weight:800;letter-spacing:-.04em;line-height:1.35;color:var(--txt);margin-bottom:12px}}
    .post-meta{{font-size:.8rem;color:var(--muted);display:flex;gap:14px;flex-wrap:wrap;margin-bottom:24px;padding-bottom:18px;border-bottom:1px solid var(--line2)}}

    /* ── 썸네일 ── */
    .post-thumb{{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;margin-bottom:28px;display:block;background:var(--bg2)}}

    /* ── 인콘텐츠 광고 ── */
    .in-ad{{margin:2rem -4px;padding:12px 4px;border-top:1px solid var(--line2);border-bottom:1px solid var(--line2);background:#fafafa;text-align:center}}
    .in-ad-label{{font-size:.62rem;color:#ccc;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}}

    /* ── 본문 ── */
    .post-body{{line-height:1.95;font-size:1rem;color:#2a2a2f}}
    .post-body h2{{font-size:1.3rem;font-weight:800;letter-spacing:-.03em;margin:2.8rem 0 1rem;color:var(--txt);padding-bottom:.55rem;border-bottom:2px solid var(--line2)}}
    .post-body h3{{font-size:1.06rem;font-weight:700;margin:1.8rem 0 .7rem;color:var(--txt)}}
    .post-body p{{margin:0 0 1.2rem}}
    .post-body ul,.post-body ol{{padding-left:1.5rem;margin:0 0 1.2rem}}
    .post-body li{{margin-bottom:.6rem;line-height:1.8}}
    .post-body strong{{color:var(--txt);font-weight:700}}
    .post-body a{{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(0,113,227,.2);transition:border-color .15s}}
    .post-body a:hover{{border-color:var(--accent)}}
    .post-body img{{max-width:100%;border-radius:12px;margin:1.2rem 0;display:block}}
    .post-body figure{{margin:1.8rem 0}}
    .post-body figcaption{{text-align:center;font-size:.78rem;color:var(--muted);margin-top:6px}}
    .post-body table{{width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:.9rem}}
    .post-body th,.post-body td{{padding:10px 14px;border:1px solid var(--line2);text-align:left}}
    .post-body th{{background:var(--bg2);font-weight:700}}
    .post-body blockquote{{margin:1.8rem 0;padding:1rem 1.4rem;border-left:4px solid var(--accent);background:rgba(0,113,227,.04);border-radius:0 10px 10px 0;font-style:italic;color:#555}}
    .post-body blockquote p{{margin:0}}
    .callout{{background:rgba(0,113,227,.06);border-left:4px solid var(--accent);padding:1rem 1.3rem;border-radius:0 10px 10px 0;margin:1.6rem 0}}
    .callout p{{margin:0;font-size:.95rem}}
    .warning{{background:rgba(255,149,0,.07);border-left:4px solid #ff9500;padding:1rem 1.3rem;border-radius:0 10px 10px 0;margin:1.6rem 0}}
    .warning p{{margin:0;font-size:.95rem}}

    /* ── 본문 하단 광고 ── */
    .bottom-ad{{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--line2);text-align:center}}
    .bottom-ad-label{{font-size:.62rem;color:#ccc;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}}

    /* ── 우측 사이드바 컬럼 ── */
    .col-right{{position:sticky;top:80px;display:flex;flex-direction:column;gap:16px}}
    .toc-box{{background:#fff;border-radius:12px;border:1px solid var(--line2);padding:16px}}
    .toc-title{{font-size:.74rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}}
    .toc-list{{list-style:none;padding:0}}
    .toc-list li{{padding:5px 0;border-bottom:1px solid var(--line2)}}
    .toc-list li:last-child{{border:none}}
    .toc-list a{{font-size:.82rem;color:var(--txt);text-decoration:none;display:block;line-height:1.4;transition:color .15s}}
    .toc-list a:hover{{color:var(--accent)}}
    .toc-list a.active{{color:var(--accent);font-weight:700}}
    .right-ad{{background:#fff;border-radius:12px;border:1px solid var(--line2);overflow:hidden;min-height:250px;padding:8px 0;text-align:center}}
    .right-ad-label{{font-size:.62rem;color:#ccc;letter-spacing:.08em;text-transform:uppercase;padding:4px 0 6px}}

    /* ── 네비 ── */
    .back-btn{{display:inline-flex;align-items:center;gap:6px;font-size:.82rem;font-weight:600;color:var(--muted);text-decoration:none;margin-bottom:16px;transition:color .15s}}
    .back-btn:hover{{color:var(--accent)}}

    /* ── 푸터 ── */
    footer{{text-align:center;padding:28px 20px;margin-top:20px;border-top:1px solid var(--line2);background:#fff;font-size:.8rem;color:var(--muted)}}
    footer a{{color:inherit;text-decoration:none;margin:0 10px}}
    footer a:hover{{text-decoration:underline}}
    .footer-copy{{margin-top:8px;font-size:.75rem}}

    /* ── 반응형 ── */
    @media(max-width:1020px){{
      .page-grid{{grid-template-columns:0 1fr 200px;padding:20px 12px 40px}}
      .col-left{{display:none}}
    }}
    @media(max-width:720px){{
      .page-grid{{grid-template-columns:1fr;padding:16px 12px 40px}}
      .col-right{{display:none}}
      .post-card{{padding:20px 18px 28px;border-radius:12px}}
    }}
  </style>
</head>
<body>

<!-- 헤더 -->
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

<!-- 상단 카테고리/도구 바 -->
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
      <a href="compound-calculator.html">💰 복리계산기</a>
      <a href="lotto.html">🎱 로또번호</a>
      <a href="code-playground.html">💻 코드연습창</a>
    </div>
  </div>
</div>

<!-- 카테고리 경로 바 -->
<div class="cat-bar">
  <div class="cat-bar-in">
    <a href="index.html">홈</a>
    <span class="sep">›</span>
    <a href="index.html">{category}</a>
    <span class="sep">›</span>
    <span class="current">{title[:30]}{'...' if len(title) > 30 else ''}</span>
  </div>
</div>

<!-- 3컬럼 그리드 -->
<div class="page-grid">

  <!-- 좌측 세로 광고 -->
  <aside class="col-left">
    <div class="v-ad">
      <div class="v-ad-label">광고</div>
      <ins class="adsbygoogle"
           style="display:block;width:160px"
           data-ad-client="ca-pub-3425189666333844"
           data-ad-slot="auto"
           data-ad-format="auto"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>
    </div>
  </aside>

  <!-- 중앙 본문 -->
  <main class="col-main">
    <a href="index.html" class="back-btn">← 전체 글 목록</a>

    <div class="post-card">
      <span class="post-cat">{category}</span>
      <h1 class="post-title">{title}</h1>
      <div class="post-meta">
        <span>📅 {date_display}</span>
        <span>📂 {category}</span>
      </div>

      {thumb_html}

      <!-- 썸네일 아래 인콘텐츠 광고 (도입부 직후) -->
      <div class="in-ad">
        <div class="in-ad-label">광고</div>
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="ca-pub-3425189666333844"
             data-ad-slot="auto"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>
      </div>

      <div class="post-body" id="postBody">
{content}
      </div>

      <!-- 본문 끝 광고 -->
      <div class="bottom-ad">
        <div class="bottom-ad-label">광고</div>
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="ca-pub-3425189666333844"
             data-ad-slot="auto"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>
      </div>
    </div>
  </main>

  <!-- 우측 사이드바: 목차 + 광고 -->
  <aside class="col-right">
    <div class="toc-box">
      <div class="toc-title">목차</div>
      <ul class="toc-list" id="tocList"></ul>
    </div>
    <div class="right-ad">
      <div class="right-ad-label">광고</div>
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="ca-pub-3425189666333844"
           data-ad-slot="auto"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({{}});</script>
    </div>
  </aside>

</div><!-- /page-grid -->

<footer>
  <a href="privacy.html">개인정보 처리방침</a> |
  <a href="terms.html">이용약관</a> |
  <a href="contact.html">문의하기</a>
  <div class="footer-copy">© 2026 비숑 웰니스. All rights reserved.</div>
</footer>

<script>
  // 목차 자동 생성 + 스크롤 하이라이트
  (function() {{
    const body = document.getElementById('postBody');
    const toc  = document.getElementById('tocList');
    if (!body || !toc) return;
    const headings = body.querySelectorAll('h2');
    headings.forEach((h, i) => {{
      h.id = h.id || 'sec-' + i;
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href        = '#' + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      toc.appendChild(li);
    }});
    const links = toc.querySelectorAll('a');
    const io = new IntersectionObserver(entries => {{
      entries.forEach(e => {{
        if (e.isIntersecting) {{
          links.forEach(l => l.classList.remove('active'));
          const t = toc.querySelector('a[href="#' + e.target.id + '"]');
          if (t) t.classList.add('active');
        }}
      }});
    }}, {{rootMargin: '-15% 0px -75% 0px'}});
    headings.forEach(h => io.observe(h));
  }})();
</script>
</body>
</html>"""


if USE_NEWS:
    # 속보뉴스 포스팅
    news_items = fetch_breaking_news()
    if news_items:
        category = "속보뉴스"
        image_query = "news korea current events"
        print("속보뉴스 글 생성 중...")
        title, excerpt, keywords, content = generate_news_post(news_items)
        references = ""
    else:
        # 뉴스 검색 실패 시 일반 토픽으로 폴백
        USE_NEWS = False

if not USE_NEWS:
    print(f"주제: {topic}")
    print("전문 자료 검색 중...")
    references = search_references(topic)

    print("개인 체험담 검색 중...")
    experiences = search_personal_experiences(topic)

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
    title, excerpt, keywords, content = generate_post(topic, references, body_image, experiences)

if USE_NEWS:
    print("이미지 검색 중...")
    thumbnail = get_image_url(image_query, category)
    body_image = ""

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
