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
    # ── 건강 (기존 39개 유지) ──
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

    # ── 응급상황 대처요령 (신규 8개, 건강관리 카테고리) ──
    ("어머니가 미끄러지셨을 때 — 의식 확인부터 119까지 첫 5분", "건강관리", "emergency fall first aid senior"),
    ("갑작스러운 가슴 통증, 심근경색 골든타임 대처법", "건강관리", "heart attack emergency response"),
    ("뇌졸중 의심 신호 FAST 체크와 4.5시간의 의미", "건강관리", "stroke FAST emergency"),
    ("코피가 멈추지 않을 때 — 올바른 응급조치 순서", "건강관리", "nosebleed first aid"),
    ("화상 입었을 때 절대 하면 안 되는 것 7가지", "건강관리", "burn first aid mistakes"),
    ("음식이 목에 걸렸을 때 — 하임리히법 정확히 하는 법", "건강관리", "heimlich choking first aid"),
    ("당뇨 환자가 의식을 잃을 때 — 저혈당 응급처치", "건강관리", "hypoglycemia diabetes emergency"),
    ("벌에 쏘였을 때 알레르기 쇼크 대처와 예방", "건강관리", "bee sting allergy emergency"),

    # ── 멘탈헬스 (정신건강·여가·보람 통합) 신규 12개 ──
    ("불안장애 자가 진단과 일상 회복법", "멘탈헬스", "anxiety disorder mental health"),
    ("우울감을 이겨내는 작은 습관 5가지", "멘탈헬스", "depression overcoming daily habits"),
    ("번아웃 신호 알아차리고 회복하는 방법", "멘탈헬스", "burnout recovery mental wellness"),
    ("명상 처음 시작하는 사람을 위한 5분 가이드", "멘탈헬스", "meditation beginner mindfulness"),
    ("스트레스 받을 때 즉시 도움되는 호흡법", "멘탈헬스", "stress relief breathing technique"),
    ("은퇴 후 시작한 정원 가꾸기 — 마음이 회복되었습니다", "멘탈헬스", "gardening retirement mental wellness"),
    ("매일 10분 감사 일기로 기분 바꾸기", "멘탈헬스", "gratitude journal mood improvement"),
    ("디지털 디톡스 실천 가이드 — 핸드폰에서 멀어지기", "멘탈헬스", "digital detox phone wellness"),
    ("외로움을 다루는 건강한 7가지 방법", "멘탈헬스", "loneliness coping mental health"),
    ("동네 복지관 봉사활동을 시작하고 달라진 일상", "멘탈헬스", "volunteer community senior wellness"),
    ("악기 배우기로 되찾은 집중력 — 시니어 추천 악기", "멘탈헬스", "music instrument senior brain"),
    ("도서관 200% 활용으로 풍요로운 노후 만들기", "멘탈헬스", "library reading retirement leisure"),

    # ── 재테크 (신규 12개) ──
    ("ETF 처음 시작하는 초보자 입문 가이드", "재테크", "ETF investing beginner finance"),
    ("연금저축·IRP로 절세하는 노후 준비법", "재테크", "retirement pension tax saving korea"),
    ("월급쟁이를 위한 자동 저축 시스템 만들기", "재테크", "automatic saving system salary"),
    ("부동산 청약 가점 올리는 실전 전략", "재테크", "real estate apartment subscription"),
    ("주식 초보가 피해야 할 7가지 투자 실수", "재테크", "stock investing mistakes beginner"),
    ("배당주 투자로 월 현금흐름 만들기", "재테크", "dividend stock cash flow investing"),
    ("가계부 앱 추천과 지출 관리 노하우", "재테크", "budget app expense tracking"),
    ("신용점수 올리는 실전 방법 7가지", "재테크", "credit score improvement finance"),
    ("초보자를 위한 미국 주식 시작 가이드", "재테크", "US stock investing beginner"),
    ("적금 vs 예금 vs CMA 어디에 넣어야 할까", "재테크", "savings deposit comparison korea"),
    ("종합소득세 절세 노하우 직장인 편", "재테크", "income tax saving employee korea"),
    ("월 100만원으로 시작하는 분산 투자 포트폴리오", "재테크", "monthly investment portfolio diversification"),

    # ── 생활정보 (여행·운동·일상 통합) 신규 12개 ──
    ("이사 갈 때 절대 잊으면 안 되는 체크리스트", "생활정보", "moving day checklist home"),
    ("국민연금 예상 수령액 조회와 늘리는 법", "생활정보", "national pension calculation"),
    ("전기·가스 요금 절약하는 12가지 실전 팁", "생활정보", "energy saving home utility bill"),
    ("정부 지원금·복지 혜택 한 번에 찾는 법", "생활정보", "government support benefit korea"),
    ("자동차 보험 가입 전 꼭 확인할 5가지", "생활정보", "car insurance comparison checklist"),
    ("건강보험 환급금 조회·신청 방법", "생활정보", "health insurance refund korea"),
    ("실손보험 청구 누락 없이 받는 노하우", "생활정보", "medical insurance claim korea"),
    ("시니어 부부에게 추천하는 국내 여행지 7곳 — 평지 위주", "생활정보", "senior couple korea travel easy"),
    ("기차로 떠나는 한국의 슬로 트래블 후기", "생활정보", "train slow travel korea senior"),
    ("실내에서 할 수 있는 시니어 유산소 운동 7가지", "생활정보", "indoor cardio senior exercise"),
    ("의자 요가로 매일 10분 — 무릎 약한 분들에게 추천", "생활정보", "chair yoga senior knee"),
    ("탄성 밴드 한 개로 시작하는 집안 근력 운동", "생활정보", "resistance band home senior"),

    # ── 반려동물 (신규 10개) ──
    ("강아지 사료 고를 때 꼭 봐야 할 성분", "반려동물", "dog food ingredients pet"),
    ("고양이 첫 입양 전 준비물 완벽 정리", "반려동물", "cat adoption first time supplies"),
    ("반려견 산책 시 주의사항과 매너", "반려동물", "dog walking etiquette pet"),
    ("강아지 분리불안 극복 훈련법", "반려동물", "dog separation anxiety training"),
    ("고양이 화장실 문제 해결 가이드", "반려동물", "cat litter box training"),
    ("노령견 건강 관리와 식이 조절", "반려동물", "senior dog health diet"),
    ("강아지 치아 관리 — 양치부터 스케일링까지", "반려동물", "dog dental care brushing"),
    ("고양이가 보내는 스트레스 신호와 해결법", "반려동물", "cat stress signs solutions"),
    ("반려견과 함께하는 건강한 다이어트 방법", "반려동물", "dog weight loss healthy diet"),
    ("처음 동물병원 방문 시 꼭 확인해야 할 것들", "반려동물", "pet first vet visit checklist"),

    # ── 뷰티건강 (신규 10개) ──
    ("피부 노화 늦추는 안티에이징 식습관", "뷰티건강", "anti aging skin diet beauty"),
    ("탈모 케어 샴푸 고르는 기준 5가지", "뷰티건강", "hair loss shampoo selection"),
    ("기미·잡티 줄이는 생활 습관과 식품", "뷰티건강", "skin pigmentation lifestyle"),
    ("건성 피부를 위한 보습 루틴 완벽 가이드", "뷰티건강", "dry skin moisturizing routine"),
    ("자외선 차단제 올바르게 바르는 법", "뷰티건강", "sunscreen application skincare"),
    ("두피 마사지로 모발 건강 되살리기", "뷰티건강", "scalp massage hair health"),
    ("입술이 자꾸 트는 진짜 원인과 케어법", "뷰티건강", "chapped lips care prevention"),
    ("여드름 흉터 자국 관리 실전 가이드", "뷰티건강", "acne scar care skincare"),
    ("손톱이 약해질 때 챙겨야 할 영양과 케어", "뷰티건강", "weak nails care nutrition"),
    ("머리카락 빠짐 줄이는 일상 습관 8가지", "뷰티건강", "hair fall reduction daily habits"),
]

# 속보뉴스 비율: 애드센스 승인 전까지 비활성화
USE_NEWS = False  # 승인 후 활성화: TAVILY_API_KEY and random.random() < 0.30


def fetch_published_titles():
    """이미 게시된 글 제목 set 반환 (중복 방지용)"""
    used = set()
    try:
        page = 1
        while True:
            resp = requests.get(
                "https://bichonbuff.com/api/posts",
                params={"page": page, "limit": 100},
                timeout=10
            )
            if resp.status_code != 200:
                print(f"⚠️ 기존 글 조회 실패 (HTTP {resp.status_code}) — 중복 체크 생략")
                return set()
            data = resp.json()
            posts = data.get("posts", [])
            if not posts:
                break
            for p in posts:
                title = (p.get("title") or "").strip()
                if title:
                    used.add(title)
            if len(posts) < 100:
                break
            page += 1
            if page > 10:  # 안전 가드 (최대 1,000개)
                break
    except Exception as e:
        print(f"⚠️ 기존 글 조회 예외: {e} — 중복 체크 생략")
        return set()
    return used


# ── 중복 방지: 이미 게시된 제목과 정확히 일치하면 후보에서 제외 ──
used_titles = fetch_published_titles()
print(f"📚 기존 게시된 글 수: {len(used_titles)}")

available_topics = [t for t in TOPICS if t[0] not in used_titles]
print(f"🎯 사용 가능한 주제: {len(available_topics)} / {len(TOPICS)}")

if not available_topics:
    print("❌ 모든 주제가 소진되었습니다. TOPICS 확장 필요. 종료합니다.")
    raise SystemExit(0)

topic, category, image_query = random.choice(available_topics)
print(f"✅ 선택된 주제: {topic} (카테고리: {category})")


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

    prompt = f"""당신은 '행복한시니어' 블로그를 5년째 직접 운영 중인 60대 운영자입니다.
의사·약사·트레이너가 아니라 **본인이 실제로 겪고, 시도하고, 실패하고, 다시 시도해 온 평범한 사람**입니다.
어머니(85세)와 함께 살며, 본인의 건강 변화·실수·재시도를 솔직히 기록합니다.
독자는 50~70대 시니어가 대부분이며, 추상적 정보보다 "내 옆집 이웃이 들려주는 이야기" 같은 글을 찾아옵니다.

주제: {topic}
{ref_section}{exp_section}
[작성 규칙 — 핵심: AdSense E-E-A-T 통과를 위한 '경험 기반' 글쓰기]

▶ 도입부 (반드시 첫 200자 안에 다음 셋 중 둘 이상 포함):
  1. 내가 직접 겪은 구체적 사건 (날짜·장소·대사 포함). 예: "작년 11월 초, 어머니가 새벽에 화장실 가시다가…"
  2. 내가 가졌던 오해 또는 실패 경험. 예: "처음엔 이게 별 거 아닌 줄 알고 그냥 넘겼는데…"
  3. 그래서 내가 무엇을 직접 알아보고, 무엇을 시도했는지의 동기. 예: "그날 이후 한 달 동안 ○○를 직접 찾아봤습니다."
  ※ "안녕하세요 여러분", "오늘은 ○○에 대해 알아볼게요" 같은 인사말은 절대 금지.

▶ 본문 (5개 h2 섹션, 1800~2500단어, 다음 요소 모두 포함):
  - 1인칭 화자 시점 유지 ("저는", "제가", "우리 어머니는", "제 친구 ○○씨가")
  - 각 섹션마다 본인 또는 주변인의 **구체 일화** 1개 이상 (실명 X, 가명·이니셜 OK)
  - "안 되더라" / "효과 없었다" / "오히려 부작용 생겼다" 같은 **실패·시행착오** 1~2회 솔직히 언급
  - 그럼에도 **무엇이 통했는지** 본인의 결론 + 그 결론에 도달한 과정
  - 객관적 근거(연구·전문가 의견·구체 수치)는 본인 경험을 뒷받침하는 보조자료로 사용 (메인이 아님)
  - blockquote 태그로 본인의 다짐·반성·깨달음 1~2개 삽입 ("그때 알았다…")
  - 표(table) 1개 — 본인이 직접 시도한 항목별 비교/체크리스트 형식

▶ 마무리:
  - 추상적 결론("건강 관리가 중요합니다") 금지
  - "오늘부터 저는 이걸 ○○하기로 했습니다" 같은 **본인의 구체적 다짐** 1줄
  - 독자에게 "여러분은 어떻게 하고 계신가요?" 식 질문 1줄로 마무리

▶ 의학·금융 정보의 경우:
  - 마지막에 면책 조항 필수: "본 글은 개인의 경험을 정리한 것으로, 의학적/법률적 자문이 아닙니다. 증상이나 의문 사항은 반드시 전문가와 상담하세요."
  - 단, 면책이 본문 톤(1인칭 체험)을 흐리지 않게 별도 박스로 처리.

▶ HTML 형식 (h2/h3/p/ul/li/strong/blockquote/table/figure 적극 활용)

[SEO 필수 규칙 — 반드시 준수]
1. 첫 <p> 첫 문장에 제목의 핵심 키워드를 자연스럽게 포함하되, **본인 일화로 시작**. 예: "○○ 증상을 처음 느낀 건 작년 가을이었습니다."
2. 링크(<a>) 앵커 텍스트는 설명형. "여기"·"클릭" 금지.
3. 키워드 반복은 자연스럽게 (1500자 기준 5~8회).
{body_image_instruction}

[AdSense 봇이 거부하는 글의 특징 — 절대 피하기]
- "○○에 대해 알아봅시다" 식 강의 톤
- 모든 정보가 일반론·교과서적으로만 나열
- 본인 흔적 0%, 누구나 쓸 수 있는 내용
- 같은 주제로 인터넷에 흔히 떠도는 정보 단순 재포장
- 결론이 "건강이 중요합니다" 같은 추상적 마무리
→ 위 5가지 중 하나라도 해당되면 글을 다시 쓰세요.

아래 형식으로만 응답하세요. 마크다운 코드블록(```)을 절대 사용하지 마세요:
TITLE: (1인칭 시점 또는 구체 사건이 드러나는 매력적 제목)
EXCERPT: (80~120자, 본인이 겪은 일이 짐작되는 한 문장)
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
