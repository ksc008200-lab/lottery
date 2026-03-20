document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('generate');
  const numbersDiv = document.getElementById('numbers');

  if (generateBtn && numbersDiv) {
    generateBtn.addEventListener('click', () => {
      console.log('Button clicked!');
      const numberDiv = document.createElement('div');
      numberDiv.className = 'number';
      numberDiv.textContent = Math.floor(Math.random() * 45) + 1;
      numbersDiv.appendChild(numberDiv);
    });
  } else {
    console.error('Initialization failed: Button or numbers container not found.');
  }
});