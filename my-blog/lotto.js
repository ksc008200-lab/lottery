document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const numbersContainer = document.getElementById('lotto-numbers');

    // 로또 번호 색상 팔레트
    const colors = [
        { background: '#fbc400' }, // 1-10
        { background: '#69c8f2' }, // 11-20
        { background: '#ff7272' }, // 21-30
        { background: '#aaa' },    // 31-40
        { background: '#b0d840' }  // 41-45
    ];

    const getBallColor = (number) => {
        if (number <= 10) return colors[0];
        if (number <= 20) return colors[1];
        if (number <= 30) return colors[2];
        if (number <= 40) return colors[3];
        return colors[4];
    };

    const generateLottoNumbers = () => {
        generateBtn.disabled = true;
        numbersContainer.innerHTML = ''; // 이전 번호 삭제

        const numbers = new Set();
        while (numbers.size < 6) {
            const randomNumber = Math.floor(Math.random() * 45) + 1;
            numbers.add(randomNumber);
        }

        const sortedNumbers = Array.from(numbers).sort((a, b) => a - b);

        sortedNumbers.forEach((number, index) => {
            setTimeout(() => {
                const ball = document.createElement('div');
                ball.className = 'lotto-ball';
                ball.textContent = number;
                const colorInfo = getBallColor(number);
                ball.style.background = colorInfo.background;
                numbersContainer.appendChild(ball);
            }, index * 200); // 0.2초 간격으로 공 생성
        });

        // 모든 공이 생성된 후 버튼 활성화
        setTimeout(() => {
            generateBtn.disabled = false;
        }, sortedNumbers.length * 200);
    };

    generateBtn.addEventListener('click', generateLottoNumbers);

    // 페이지 로드 시 초기 번호 생성
    generateLottoNumbers();
});
