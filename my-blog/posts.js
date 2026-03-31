/**
 * 비숑 웰니스 - 포스트 목록 (시니어 건강 전문 블로그)
 *
 * 새 글 추가 방법:
 * 1. post-template.html 복사 → post-[이름].html 로 저장
 * 2. 아래 배열에 항목 추가
 * 3. GitHub push → 자동 배포 완료
 */

const POSTS = [
  {
    id: 'cardio-comparison-walking-running-cycling',
    title: '60대 유산소 운동 비교 — 걷기 vs 달리기 vs 자전거, 시니어에게 맞는 운동은?',
    excerpt: '관절 부담, 낙상 위험, 체력 소모를 기준으로 60대 이상 시니어에게 가장 안전하고 효과적인 유산소 운동을 비교했습니다. 내 몸에 맞는 운동을 찾아보세요.',
    date: '2026-03-21',
    category: '시니어 운동',
    thumbnail: '',
    file: 'post-cardio-comparison-walking-running-cycling.html'
  },
  {
    id: 'senior-diet',
    title: '시니어 건강을 위한 식단 — 60대 이상 필수 영양 가이드',
    excerpt: '근육 손실 예방, 뼈 건강 유지, 만성질환 예방을 위한 시니어 맞춤 식단 전략. 꼭 챙겨야 할 영양소와 하루 식사 구성법을 정리했습니다.',
    date: '2026-03-20',
    category: '시니어 식단',
    thumbnail: '',
    file: 'post-senior-diet.html'
  },
  {
    id: 'walking-benefits',
    title: '60대 이상 하루 30분 걷기의 놀라운 건강 효과',
    excerpt: '특별한 장비도 헬스장도 필요 없습니다. 시니어에게 걷기가 최고의 운동인 이유 — 혈압·혈당·골다공증·치매 예방까지 하루 30분으로 달라집니다.',
    date: '2026-03-18',
    category: '시니어 운동',
    thumbnail: 'images/post-walking.svg',
    file: 'post-walking-benefits.html'
  },
  {
    id: 'supplements-top5',
    title: '60대 이상 꼭 챙겨야 할 영양제 TOP 5 — 근거 있는 추천',
    excerpt: '시니어에게 특히 중요한 영양제 5가지를 소개합니다. 비타민 D, 오메가-3, 칼슘, 마그네슘, 프로바이오틱스의 효능과 올바른 복용법.',
    date: '2026-03-15',
    category: '영양제 가이드',
    thumbnail: 'images/post-supplements.svg',
    file: 'post-supplements-top5.html'
  },
  {
    id: 'diet-noyoyo',
    title: '60대 체중 관리 — 요요 없이 건강하게 유지하는 방법',
    excerpt: '60대 이상의 체중 관리는 젊을 때와 다릅니다. 근육 손실 없이 체중을 유지하는 시니어 맞춤 식이 전략 5가지 핵심 원칙을 알아보세요.',
    date: '2026-03-10',
    category: '시니어 식단',
    thumbnail: 'images/post-diet.svg',
    file: 'post-diet-noyoyo.html'
  },
  {
    id: 'blood-pressure',
    title: '고혈압 낮추는 생활 습관 7가지 — 시니어를 위한 혈압 관리법',
    excerpt: '고혈압 초기라면 생활 습관만으로도 혈압을 정상으로 되돌릴 수 있습니다. 60대 이상에게 효과적인 나트륨 줄이기, DASH 식단, 운동 등 7가지 방법.',
    date: '2026-03-05',
    category: '만성질환 관리',
    thumbnail: 'images/post-blood-pressure.svg',
    file: 'post-blood-pressure.html'
  },
  // 새 글을 위에 추가하세요 (최신 글이 위로 오도록)
];

// 카테고리 목록 (사이드바에 표시됨)
const CATEGORIES = ['시니어 운동', '시니어 식단', '영양제 가이드', '만성질환 관리'];
