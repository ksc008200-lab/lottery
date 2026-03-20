document.getElementById('generate').addEventListener('click', function() {
    const numbersContainer = document.getElementById('numbers-container');
    numbersContainer.innerHTML = ''; // Clear previous numbers

    const numbers = generateLottoNumbers();

    const numbersDiv = document.createElement('div');
    numbersDiv.id = 'numbers';

    numbers.forEach(num => {
        const numberDiv = document.createElement('div');
        numberDiv.className = 'number';
        numberDiv.textContent = num;
        numbersDiv.appendChild(numberDiv);
    });

    numbersContainer.appendChild(numbersDiv);
});

function generateLottoNumbers() {
    const numbers = new Set();
    while (numbers.size < 6) {
        numbers.add(Math.floor(Math.random() * 45) + 1);
    }
    return Array.from(numbers).sort((a, b) => a - b);
}
