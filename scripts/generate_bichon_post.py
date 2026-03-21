import anthropic
import requests
import os
import random

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
BICHON_API_KEY = os.environ["BICHON_API_KEY"]

TOPICS = [
    ("혈압 관리에 좋은 음식 TOP 5", "건강관리"),
    ("하루 30분 걷기의 놀라운 효과", "건강생활"),
    ("면역력 높이는 생활습관 7가지", "건강"),
    ("시니어를 위한 근력 운동 가이드", "시니어건강"),
    ("수면의 질을 높이는 방법", "건강생활"),
    ("당뇨 예방을 위한 식단 관리", "건강관리"),
    ("무릎 통증 완화 스트레칭", "건강"),
    ("장 건강을 위한 프로바이오틱스 활용법", "건강식품"),
    ("비타민D 결핍 증상과 보충 방법", "건강식품"),
    ("스트레스 해소에 좋은 음식", "건강생활"),
    ("고혈압 환자를 위한 저염식 레시피", "건강관리"),
    ("치매 예방을 위한 두뇌 활동", "시니어건강"),
    ("오메가3 효능과 올바른 섭취법", "건강식품"),
    ("골다공증 예방 운동과 식품", "시니어건강"),
    ("다이어트 중 근육 유지하는 방법", "건강다이어트"),
    ("공복 혈당 낮추는 생활 습관", "건강관리"),
    ("눈 건강을 지키는 루테인 섭취법", "건강식품"),
    ("피로 회복에 좋은 영양소와 음식", "건강"),
    ("관절 건강을 위한 콜라겐 섭취 가이드", "건강백세"),
    ("항산화 식품으로 노화 늦추는 법", "건강백세"),
]

topic, category = random.choice(TOPICS)

prompt = f"""당신은 건강 전문 블로거입니다. 다음 주제로 한국어 블로그 포스트를 작성해주세요.

주제: {topic}

요구사항:
- HTML 형식으로 작성 (h2, h3, p, ul, li 태그 사용)
- 분량: 800~1200단어
- 구성: 도입부 → 본문 3~4개 섹션 → 마무리
- 실용적이고 구체적인 정보 포함
- 친근하고 읽기 쉬운 문체
- 제목(title)과 본문(content)을 아래 형식으로 반환:

TITLE: (제목)
CONTENT: (HTML 본문)"""

message = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=2048,
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

payload = {
    "title": title,
    "content": content,
    "category": category,
    "status": "published"
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
