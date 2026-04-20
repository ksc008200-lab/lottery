const sharp = require('sharp');

const svg = `
<svg width="600" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="45%" style="stop-color:#16213e"/>
      <stop offset="100%" style="stop-color:#0f3460"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="600" height="600" fill="url(#bg)"/>

  <!-- Big 한 watermark -->
  <text x="300" y="380" text-anchor="middle" font-family="serif" font-size="380" fill="rgba(255,255,255,0.04)" font-weight="bold">한</text>

  <!-- Flag emoji area - colored rectangle instead -->
  <rect x="270" y="60" width="60" height="40" rx="4" fill="#003478"/>
  <rect x="270" y="60" width="60" height="13" fill="#CD2E3A"/>
  <rect x="270" y="87" width="60" height="13" fill="#CD2E3A"/>
  <text x="300" y="92" text-anchor="middle" font-family="serif" font-size="32">🇰🇷</text>

  <!-- Badge -->
  <rect x="170" y="115" width="260" height="28" rx="14" fill="#E8C84A"/>
  <text x="300" y="134" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#1a1a2e" letter-spacing="2">COMPLETE BEGINNERS GUIDE</text>

  <!-- Main Title -->
  <text x="300" y="205" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="56" font-weight="900" fill="white">Learn</text>
  <text x="300" y="265" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="60" font-weight="900" fill="#E8C84A">Korean</text>

  <!-- Korean subtitle -->
  <text x="300" y="298" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.45)">&#xD55C;&#xAD6D;&#xC5B4; &#xC644;&#xC804; &#xD559;&#xC2B5; &#xAC00;&#xC774;&#xB4DC;</text>

  <!-- Divider -->
  <rect x="270" y="316" width="60" height="3" rx="1.5" fill="#E8C84A"/>

  <!-- Feature list -->
  <text x="300" y="352" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="rgba(255,255,255,0.85)">&#x2705; 28 Chapters - Zero to Conversational</text>
  <text x="300" y="375" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="rgba(255,255,255,0.85)">&#x2705; Grammar · Vocab · Real Conversations</text>
  <text x="300" y="398" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="rgba(255,255,255,0.85)">&#x2705; K-pop · Travel · Food · Slang</text>
  <text x="300" y="421" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="rgba(255,255,255,0.85)">&#x2705; Quizzes &amp; Emoji Picture Cards</text>

  <!-- Price badge -->
  <rect x="185" y="445" width="230" height="46" rx="23" fill="rgba(232,200,74,0.12)" stroke="#E8C84A" stroke-width="2"/>
  <text x="300" y="475" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="20" font-weight="900" fill="#E8C84A">PDF — $9.99</text>

  <!-- Domain -->
  <text x="300" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="rgba(255,255,255,0.25)" letter-spacing="2">KRGUIDE.COM</text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile('thumbnail.png')
  .then(() => console.log('thumbnail.png created!'))
  .catch(e => console.error('Error:', e.message));
