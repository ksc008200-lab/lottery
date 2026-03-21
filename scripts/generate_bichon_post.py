import anthropic
import requests
import os
import random

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


def get_image_url(query):
    if not PEXELS_API_KEY:
        print("PEXELS_API_KEY 없음 - 이미지 스킵")
        return ""
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
            print(f"이미지 없음. 응답: {data}")
    except Exception as e:
        print(f"이미지 가져오기 실패: {e}")
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


def generate_post(topic, references=""):
    ref_section = f"""
[참고 자료 - 아래 내용을 바탕으로 신뢰도 높은 글을 작성하세요]
{references}
""" if references else ""

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

아래 형식으로만 응답하세요:
TITLE: (매력적인 제목, 숫자나 효과를 포함)
CONTENT: (HTML 본문 전체)"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text
    lines = response_text.split("\n")

    title = topic
    content_lines = []
    content_started = False

    for line in lines:
        if line.startswith("TITLE:"):
            title = line.replace("TITLE:", "").strip()
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

    return title, content


print(f"주제: {topic}")
print("자료 검색 중...")
references = search_references(topic)
print("글 생성 중...")
title, content = generate_post(topic, references)

print("이미지 검색 중...")
thumbnail = get_image_url(image_query)
if thumbnail:
    print(f"이미지 URL: {thumbnail[:60]}...")
else:
    print("이미지 없이 진행")

payload = {
    "title": title,
    "content": content,
    "category": category,
    "status": "published",
    "thumbnail": thumbnail,
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
