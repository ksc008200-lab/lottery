document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const numbersContainer = document.getElementById('lotto-numbers');

    // 공 색깔 배열
    const colors = [
        '#fbc400', // 노란색
        '#69c8f2', // 파란색
        '#ff7272', // 빨간색
        '#aaa',     // 회색
        '#b0d840'  // 녹색
    ];

    generateBtn.addEventListener('click', () => {
        generateBtn.disabled = true;
        numbersContainer.innerHTML = ''; // 이전 번호 삭제

        // 1. 1~45 숫자 배열 생성
        const candidate = Array(45).fill().map((v, i) => i + 1);

        // 2. 랜덤하게 섞기 (피셔-예이츠 셔플)
        for (let i = candidate.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
        }

        // 3. 6개 번호 선택 및 정렬
        const winningNumbers = candidate.slice(0, 6).sort((a, b) => a - b);

        // 4. 화면에 번호 표시 (애니메이션과 함께)
        winningNumbers.forEach((number, index) => {
            setTimeout(() => {
                const ball = document.createElement('div');
                ball.className = 'lotto-ball';
                ball.textContent = number;

                // 번호 구간에 따라 색상 결정
                let colorIndex = Math.floor((number - 1) / 10);
                ball.style.backgroundColor = colors[colorIndex];

                // 애니메이션 지연을 위해 스타일 속성 추가
                ball.style.animationDelay = `${index * 0.1}s`;

                numbersContainer.appendChild(ball);
            }, index * 150); // 순차적으로 나타나는 효과
        });

        // 애니메이션이 끝난 후 버튼 활성화
        setTimeout(() => {
            generateBtn.disabled = false;
        }, winningNumbers.length * 150);
    });
});
