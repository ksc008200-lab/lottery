/**
 * 비숑 웰니스 - 포스트 목록
 *
 * 새 글 추가 방법:
 * 1. post-template.html 복사 → post-[이름].html 로 저장
 * 2. 아래 배열에 항목 추가
 * 3. GitHub push → 자동 배포 완료
 */

const POSTS = [
  {
    id: 'senior-diet',
    title: '시니어 건강을 위한 식단 — 60대 이상 필수 영양 가이드',
    excerpt: '근육 손실 예방, 뼈 건강 유지, 만성질환 예방을 위한 시니어 맞춤 식단 전략. 꼭 챙겨야 할 영양소와 하루 식사 구성법을 정리했습니다.',
    date: '2026-03-20',
    category: '식단',
    thumbnail: '',
    file: 'post-senior-diet.html'
  },
  {
    id: 'walking-benefits',
    title: '하루 30분 걷기의 놀라운 건강 효과',
    excerpt: '특별한 장비도 헬스장도 필요 없습니다. 하루 30분 걷기만으로 심혈관 건강, 체중 관리, 혈당 조절, 정신 건강까지 달라지는 이유를 알아보세요.',
    date: '2026-03-18',
    category: '운동',
    thumbnail: 'images/post-walking.svg',
    file: 'post-walking-benefits.html'
  },
  {
    id: 'supplements-top5',
    title: '꼭 챙겨야 할 영양제 TOP 5 — 근거 있는 추천',
    excerpt: '수많은 영양제 중 실제로 효과가 검증된 5가지만 소개합니다. 비타민 D, 오메가-3, 마그네슘, 프로바이오틱스, 비타민 C의 효능과 올바른 복용법.',
    date: '2026-03-15',
    category: '영양제',
    thumbnail: 'images/post-supplements.svg',
    file: 'post-supplements-top5.html'
  },
  {
    id: 'diet-noyoyo',
    title: '요요 없이 살 빼는 방법 — 평생 유지되는 다이어트 전략',
    excerpt: '굶는 다이어트는 왜 반드시 실패할까요? 요요 현상의 원인과 해결책, 과학적으로 검증된 지속 가능한 체중 감량 5가지 핵심 원칙을 알아보세요.',
    date: '2026-03-10',
    category: '다이어트',
    thumbnail: 'images/post-diet.svg',
    file: 'post-diet-noyoyo.html'
  },
  {
    id: 'blood-pressure',
    title: '혈압 낮추는 생활 습관 7가지 — 약 없이 혈압 관리하기',
    excerpt: '고혈압 초기라면 생활 습관만으로도 혈압을 정상으로 되돌릴 수 있습니다. 의학적으로 검증된 나트륨 줄이기, DASH 식단, 운동 등 7가지 방법.',
    date: '2026-03-05',
    category: '건강정보',
    thumbnail: 'images/post-blood-pressure.svg',
    file: 'post-blood-pressure.html'
  },
  // 새 글을 위에 추가하세요 (최신 글이 위로 오도록)
];

// 카테고리 목록 (사이드바에 표시됨)
const CATEGORIES = ['건강정보', '운동', '식단', '영양제', '다이어트'];
