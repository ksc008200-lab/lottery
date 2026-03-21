"""
비숑 웰니스 - 자동 포스트 생성 스크립트
Claude API를 사용해 건강 블로그 포스트를 생성하고 my-blog 디렉토리에 저장합니다.
"""

import anthropic
import json
import os
import re
import sys
from datetime import date, datetime

# ──────────────────────────────────────────
# 주제 풀 (카테고리별)
# ──────────────────────────────────────────
TOPICS = [
    {"category": "운동",     "subject": "스트레칭의 효과와 매일 아침 5분 루틴"},
    {"category": "식단",     "subject": "단백질 섭취 가이드 — 하루 적정량과 음식 추천"},
    {"category": "건강정보", "subject": "수면의 질 높이는 방법 7가지"},
    {"category": "영양제",   "subject": "비타민 B군 완전 정리 — 종류별 효능과 결핍 증상"},
    {"category": "다이어트", "subject": "간헐적 단식 완전 가이드 — 16:8 방법과 주의사항"},
    {"category": "운동",     "subject": "홈 트레이닝 입문 — 장비 없이 할 수 있는 전신 운동"},
    {"category": "식단",     "subject": "장 건강을 위한 식단 — 유익균 늘리는 음식 10가지"},
    {"category": "건강정보", "subject": "스트레스 해소법 — 코르티솔 낮추는 5가지 습관"},
    {"category": "영양제",   "subject": "마그네슘 효능과 결핍 증상, 올바른 복용법"},
    {"category": "다이어트", "subject": "탄수화물 조절 다이어트 — 좋은 탄수화물 vs 나쁜 탄수화물"},
    {"category": "운동",     "subject": "무릎 건강 지키는 운동 — 연골 보호하는 저충격 운동법"},
    {"category": "식단",     "subject": "항염증 식품 베스트 10 — 만성 염증 줄이는 식사 전략"},
    {"category": "건강정보", "subject": "눈 건강 지키기 — 디지털 눈 피로 예방법"},
    {"category": "영양제",   "subject": "오메가-3 효능과 선택 방법 — EPA vs DHA 차이"},
    {"category": "다이어트", "subject": "식욕 조절 방법 — 과식 막는 과학적 전략 6가지"},
    {"category": "운동",     "subject": "유연성 높이는 요가 포즈 — 초보자를 위한 10분 루틴"},
    {"category": "식단",     "subject": "혈당 안정화 식사법 — 혈당 스파이크 예방하는 식단"},
    {"category": "건강정보", "subject": "면역력 높이는 생활 습관 8가지"},
    {"category": "영양제",   "subject": "프로바이오틱스 완벽 가이드 — 고르는 법과 복용 타이밍"},
    {"category": "다이어트", "subject": "체지방 태우는 유산소 운동 비교 — 걷기 vs 달리기 vs 자전거"},
]

# ──────────────────────────────────────────
# 오늘 주제 선택 (날짜 기반으로 순환)
# ──────────────────────────────────────────
def pick_topic() -> dict:
    day_index = (date.today() - date(2026, 1, 1)).days
    return TOPICS[day_index % len(TOPICS)]


# ──────────────────────────────────────────
# 기존 포스트 ID 목록 읽기 (중복 방지)
# ──────────────────────────────────────────
def get_existing_ids(posts_js_path: str) -> list[str]:
    if not os.path.exists(posts_js_path):
        return []
    with open(posts_js_path, encoding="utf-8") as f:
        content = f.read()
    return re.findall(r"id:\s*'([^']+)'", content)


# ──────────────────────────────────────────
# Claude API로 포스트 생성
# ──────────────────────────────────────────
def generate_post(topic: dict) -> dict:
    client = anthropic.Anthropic()

    prompt = f"""당신은 "비숑 웰니스" 건강 블로그의 전문 작가입니다.
아래 주제로 한국어 건강 블로그 포스트를 작성해주세요.

주제: {topic['subject']}
카테고리: {topic['category']}

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):

{{
  "title": "포스트 제목 (클릭하고 싶게, 구체적으로)",
  "excerpt": "포스트 요약 (2-3문장, 80자 내외)",
  "slug": "영문-소문자-하이픈-파일명 (예: morning-stretch-routine)",
  "keywords": "SEO 키워드 5-7개 쉼표 구분",
  "body_html": "본문 HTML (아래 규칙 준수)"
}}

본문 HTML 규칙:
- <h2> 소제목 4-6개 사용
- <p>, <ul>, <ol>, <li>, <strong> 사용 가능
- 강조 박스: <div class="callout"><p><strong>핵심:</strong> 내용</p></div>
- 주의 박스: <div class="warning"><p><strong>주의:</strong> 내용</p></div>
- 총 분량: 800-1200자 (본문만)
- 실용적이고 근거 있는 정보 위주로 작성
- 친근하지만 전문적인 어조
"""

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # JSON 블록만 추출
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise ValueError(f"JSON 파싱 실패:\n{raw}")
    return json.loads(match.group())


# ──────────────────────────────────────────
# HTML 파일 생성
# ──────────────────────────────────────────
HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | 비숑 웰니스</title>
  <meta name="description" content="{excerpt}">
  <meta name="keywords" content="{keywords}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{excerpt}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://bichonbuff.com/{filename}">
  <meta property="og:site_name" content="비숑 웰니스">
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
    .post-body{{line-height:1.9;font-size:1rem;color:#2d2d2f}}
    .post-body h2{{font-size:1.3rem;font-weight:700;letter-spacing:-.03em;margin:2.8rem 0 1rem;color:var(--txt);padding-bottom:.5rem;border-bottom:1px solid var(--line2)}}
    .post-body h3{{font-size:1.05rem;font-weight:700;margin:1.8rem 0 .7rem;color:var(--txt)}}
    .post-body p{{margin:0 0 1.2rem}}
    .post-body ul,.post-body ol{{padding-left:1.5rem;margin:0 0 1.2rem}}
    .post-body li{{margin-bottom:.6rem}}
    .post-body strong{{color:var(--txt)}}
    .callout{{background:rgba(0,113,227,.06);border-left:3px solid var(--accent);padding:1rem 1.2rem;border-radius:0 8px 8px 0;margin:1.5rem 0}}
    .callout p{{margin:0}}
    .warning{{background:rgba(255,149,0,.07);border-left:3px solid #ff9500;padding:1rem 1.2rem;border-radius:0 8px 8px 0;margin:1.5rem 0}}
    .warning p{{margin:0}}
    .post-body table{{width:100%;border-collapse:collapse;margin:1.5rem 0;font-size:.9rem}}
    .post-body th,.post-body td{{padding:10px 14px;border:1px solid var(--line2);text-align:left}}
    .post-body th{{background:var(--bg2);font-weight:700}}
    footer{{text-align:center;padding:24px 20px;margin-top:60px;border-top:1px solid var(--line2);font-size:.8rem;color:var(--muted)}}
    footer a{{color:inherit;text-decoration:none;margin:0 10px}}
    footer a:hover{{text-decoration:underline}}
    .footer-copy{{margin-top:8px;font-size:.75rem}}
    @media(max-width:600px){{.post-wrap{{padding:28px 16px 60px}}}}
  </style>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8158224613066206" crossorigin="anonymous"></script>
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
  <div class="post-meta">{date_ko} · {category}</div>

  <div class="post-body">
{body_html}
  </div>
</div>

<footer>
  <a href="privacy.html">개인정보 처리방침</a> |
  <a href="terms.html">이용약관</a> |
  <a href="contact.html">문의하기</a>
  <div class="footer-copy">© 2025 비숑 웰니스. All rights reserved.</div>
</footer>
</body>
</html>
"""

def build_html(post: dict, topic: dict, today: date) -> str:
    filename = f"post-{post['slug']}.html"
    date_ko = today.strftime("%Y년 %-m월 %-d일")
    body = "\n".join("    " + line for line in post["body_html"].splitlines())
    return HTML_TEMPLATE.format(
        title=post["title"],
        excerpt=post["excerpt"],
        keywords=post["keywords"],
        filename=filename,
        category=topic["category"],
        date_ko=date_ko,
        body_html=body,
    )


# ──────────────────────────────────────────
# posts.js 업데이트
# ──────────────────────────────────────────
def update_posts_js(posts_js_path: str, post: dict, topic: dict, today: date):
    with open(posts_js_path, encoding="utf-8") as f:
        content = f.read()

    slug = post["slug"]
    filename = f"post-{slug}.html"
    date_str = today.strftime("%Y-%m-%d")

    new_entry = f"""  {{
    id: '{slug}',
    title: '{post["title"].replace("'", "\\'")}',
    excerpt: '{post["excerpt"].replace("'", "\\'")}',
    date: '{date_str}',
    category: '{topic["category"]}',
    thumbnail: '',
    file: '{filename}'
  }},"""

    # POSTS 배열 첫 번째 항목 앞에 삽입
    updated = content.replace("const POSTS = [", f"const POSTS = [\n{new_entry}", 1)

    with open(posts_js_path, "w", encoding="utf-8") as f:
        f.write(updated)


# ──────────────────────────────────────────
# 메인
# ──────────────────────────────────────────
def main():
    blog_dir = os.path.join(os.path.dirname(__file__), "..", "my-blog")
    posts_js_path = os.path.join(blog_dir, "posts.js")

    today = date.today()
    topic = pick_topic()
    print(f"[{today}] 주제: {topic['subject']} ({topic['category']})")

    # 중복 체크
    existing_ids = get_existing_ids(posts_js_path)

    # 포스트 생성
    print("Claude API 호출 중...")
    post = generate_post(topic)
    slug = post["slug"]

    if slug in existing_ids:
        slug = f"{slug}-{today.strftime('%Y%m%d')}"
        post["slug"] = slug
        print(f"  slug 중복 → {slug}")

    filename = f"post-{slug}.html"
    html_path = os.path.join(blog_dir, filename)

    # HTML 파일 저장
    html_content = build_html(post, topic, today)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"HTML 생성: {html_path}")

    # posts.js 업데이트
    update_posts_js(posts_js_path, post, topic, today)
    print(f"posts.js 업데이트 완료")

    # GitHub Actions에서 사용할 출력
    print(f"::set-output name=filename::{filename}")
    print(f"::set-output name=title::{post['title']}")


if __name__ == "__main__":
    main()
