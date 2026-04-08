"""
Wikidocs 자동 업로드 스크립트
사용법:
  pip install selenium
  python wikidocs_upload.py
"""

import time
import getpass
import sys
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# ── 설정 ──────────────────────────────────────────
WIKIDOCS_URL = "https://wikidocs.net"
HTML_FILE    = "korean-guide/index.html"   # index.html 경로 (이 스크립트 기준)

BOOK_TITLE   = "Learn Korean: A Complete Guide | 한국어 완전 학습 가이드"
BOOK_DESC    = "한글부터 고급 문법·문화·어휘까지 — 41개 챕터로 배우는 완전 한국어 학습 가이드"

CHAPTERS = [
    ("Ch1",  "Hangul Birth — 한글의 탄생"),
    ("Ch2",  "Consonants — 자음"),
    ("Ch3",  "Vowels — 모음"),
    ("Ch4",  "Batchim — 받침"),
    ("Ch5",  "Numbers — 숫자"),
    ("Ch6",  "Vocabulary 200 — 필수 단어"),
    ("Ch7",  "Sentence Structure — 문장 구조"),
    ("Ch8",  "Verb Conjugation — 동사 활용"),
    ("Ch9",  "Conversations — 실생활 대화"),
    ("Ch10", "존댓말 & 반말 — Korean Respect"),
    ("Ch11", "Tenses — 시제"),
    ("Ch12", "Grammar Patterns — 문법 패턴"),
    ("Ch13", "Particles — 조사"),
    ("Ch14", "Question Words — 의문사"),
    ("Ch15", "Food & Restaurants — 음식 & 식당"),
    ("Ch16", "Shopping & Money — 쇼핑 & 돈"),
    ("Ch17", "Transportation — 교통 & 길 찾기"),
    ("Ch18", "Family — 가족 & 관계"),
    ("Ch19", "Weather & Seasons — 날씨 & 계절"),
    ("Ch20", "Holidays & Culture — 명절 & 문화"),
    ("Ch21", "Adjectives — 형용사"),
    ("Ch22", "Body & Health — 신체 & 건강"),
    ("Ch23", "K-pop & Entertainment — K팝 & 한류"),
    ("Ch24", "Hobbies & Free Time — 취미 & 여가"),
    ("Ch25", "Work & School — 직장 & 학교"),
    ("Ch26", "Love & Dating — 사랑 & 연애"),
    ("Ch27", "Travel in Korea — 한국 여행"),
    ("Ch28", "Slang & Internet — 슬랭 & MZ세대"),
    ("Ch29", "Spelling Rules — 맞춤법"),
    ("Ch30", "Dictionary Guide — 사전 찾는 법"),
    ("Ch31", '"우리" Culture — 우리 문화'),
    ("Ch32", "No Subject Culture — 주어 생략 문화"),
    ("Ch33", "Hanja & Pure Korean — 한자어 & 고유어"),
    ("Ch34", "千字文 · Hanja Unlocks Korean — 천자문"),
    ("Ch35", "Seoul Standard & Dialects — 표준어 & 사투리"),
    ("Ch36", "Korean History — 한국의 역사"),
    ("Ch37", "BTS & K-Culture — 한류 & K-문화"),
    ("Ch38", "500 Essential Nouns — 필수 명사 500개"),
    ("Ch39", "200 Essential Verbs — 필수 동사 200개"),
    ("Ch40", "200 Essential Adverbs — 필수 부사 200개"),
    ("Ch41", "Jeju Dialect — 제주 방언"),
]
# ─────────────────────────────────────────────────


def extract_chapter_html(html_file, ch_id):
    """index.html에서 특정 챕터 HTML 추출"""
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()

    ch_id_lower = ch_id.lower()  # ch1, ch2 ...
    # 챕터 시작
    start = content.find(f'id="{ch_id_lower}"')
    if start == -1:
        return f"<p>{ch_id} 내용을 찾을 수 없습니다.</p>"
    # 다음 챕터 시작 위치
    next_ch_num = int(re.search(r'\d+', ch_id_lower).group()) + 1
    next_ch = f'id="ch{next_ch_num}"'
    end = content.find(next_ch, start)
    if end == -1:
        end = content.find('</body>', start)

    chapter_html = content[start:end]
    # chapter 래퍼 div만 추출
    div_start = content.rfind('<div', 0, start)
    return content[div_start:end] + '</div>'


def setup_driver():
    """Chrome WebDriver 설정"""
    options = Options()
    # options.add_argument('--headless')  # 화면 보려면 주석 유지
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--window-size=1280,900')
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36')
    driver = webdriver.Chrome(options=options)
    return driver


def wait_and_click(driver, by, value, timeout=10):
    el = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, value)))
    el.click()
    return el


def wait_for(driver, by, value, timeout=10):
    return WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))


def login(driver, email, password):
    print("🔐 로그인 중...")
    driver.get(f"{WIKIDOCS_URL}/accounts/login/")
    time.sleep(3)  # Cloudflare 챌린지 통과 대기

    wait_for(driver, By.NAME, "username").send_keys(email)
    driver.find_element(By.NAME, "password").send_keys(password)
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    time.sleep(2)

    if "login" in driver.current_url:
        print("❌ 로그인 실패. 이메일/비밀번호를 확인하세요.")
        driver.quit()
        sys.exit(1)
    print("✅ 로그인 성공!")


def create_book(driver):
    print(f"\n📚 책 생성 중: {BOOK_TITLE}")
    driver.get(f"{WIKIDOCS_URL}/book/create/")
    time.sleep(2)

    # 제목 입력
    title_input = wait_for(driver, By.NAME, "subject")
    title_input.clear()
    title_input.send_keys(BOOK_TITLE)

    # 설명 입력
    try:
        desc = driver.find_element(By.NAME, "description")
        desc.send_keys(BOOK_DESC)
    except:
        pass

    # 저장
    driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
    time.sleep(2)

    # 책 ID 추출
    book_url = driver.current_url
    book_id = re.search(r'/book/(\d+)', book_url)
    if book_id:
        book_id = book_id.group(1)
        print(f"✅ 책 생성 완료! Book ID: {book_id}")
        print(f"   URL: {WIKIDOCS_URL}/book/{book_id}")
        return book_id
    else:
        print(f"⚠️ 책 ID를 찾을 수 없음. 현재 URL: {book_url}")
        return None


def create_page(driver, book_id, title, html_content, index):
    print(f"  📄 [{index+1}/41] {title} 업로드 중...")
    driver.get(f"{WIKIDOCS_URL}/article/create/{book_id}/")
    time.sleep(2)

    # 제목
    try:
        title_input = wait_for(driver, By.NAME, "subject", timeout=8)
        title_input.clear()
        title_input.send_keys(title)
    except:
        print(f"    ⚠️ 제목 입력란을 찾지 못했습니다.")
        return False

    # HTML 에디터 모드로 전환 후 내용 입력
    try:
        # HTML 탭 클릭 (에디터에 따라 다를 수 있음)
        html_btn = driver.find_elements(By.XPATH, "//*[contains(text(),'HTML') or contains(text(),'html')]")
        if html_btn:
            html_btn[0].click()
            time.sleep(1)

        # textarea에 직접 입력
        textarea = driver.find_element(By.NAME, "content")
        driver.execute_script("arguments[0].value = arguments[1];", textarea, html_content[:50000])
    except Exception as e:
        print(f"    ⚠️ 내용 입력 실패: {e}")

    # 저장
    try:
        driver.find_element(By.CSS_SELECTOR, "button[type='submit']").click()
        time.sleep(2)
        print(f"    ✅ 완료!")
        return True
    except Exception as e:
        print(f"    ❌ 저장 실패: {e}")
        return False


def main():
    print("=" * 50)
    print("  위키독스 자동 업로드 스크립트")
    print("  Learn Korean — 41 Chapters")
    print("=" * 50)

    email    = input("\n위키독스 이메일: ").strip()
    password = getpass.getpass("비밀번호 (입력해도 안 보임): ")

    print("\n브라우저를 시작합니다...")
    driver = setup_driver()

    try:
        login(driver, email, password)
        book_id = create_book(driver)

        if not book_id:
            print("책 생성 실패. 수동으로 책을 만들고 book_id를 입력하세요.")
            book_id = input("Book ID: ").strip()

        print(f"\n📖 챕터 업로드 시작 (총 {len(CHAPTERS)}개)")
        success = 0
        for i, (ch_id, title) in enumerate(CHAPTERS):
            html = extract_chapter_html(HTML_FILE, ch_id)
            ok = create_page(driver, book_id, title, html, i)
            if ok:
                success += 1
            time.sleep(1.5)  # 서버 부하 방지

        print(f"\n🎉 완료! {success}/{len(CHAPTERS)} 챕터 업로드 성공")
        print(f"📚 책 URL: {WIKIDOCS_URL}/book/{book_id}")

    except KeyboardInterrupt:
        print("\n\n중단되었습니다.")
    finally:
        input("\n브라우저를 닫으려면 Enter 키를 누르세요...")
        driver.quit()


if __name__ == "__main__":
    main()
