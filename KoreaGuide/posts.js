/**
 * KR Guide - Post List
 *
 * How to add a new post:
 * 1. Copy post-template.html → save as post-[name].html
 * 2. Add an entry below
 * 3. Push to GitHub → auto deploy
 */

const POSTS = [
  {
    id: 'seoul-travel-guide',
    title: 'Seoul Travel Guide 2026 — Everything You Need to Know',
    excerpt: 'First time in Seoul? This complete guide covers the best neighborhoods, must-see attractions, transportation tips, and hidden gems to make your Seoul trip unforgettable.',
    date: '2026-03-31',
    category: 'Travel Guide',
    thumbnail: '',
    file: 'post-seoul-travel-guide.html'
  },
  {
    id: 'korea-visa-guide',
    title: 'Korea Visa Guide — Types, Requirements & How to Apply',
    excerpt: 'Planning to visit or live in Korea? This guide covers all visa types — tourist, working holiday, D-10 job seeker, E-2 English teacher — with step-by-step application tips.',
    date: '2026-03-28',
    category: 'Living in Korea',
    thumbnail: '',
    file: 'post-korea-visa-guide.html'
  },
  {
    id: 'korean-basics',
    title: 'Korean for Beginners — 50 Essential Phrases to Know Before You Go',
    excerpt: 'You don\'t need to be fluent to get around Korea. Learn these 50 essential Korean phrases for greetings, shopping, ordering food, and getting help — with pronunciation guides.',
    date: '2026-03-25',
    category: 'Learn Korean',
    thumbnail: '',
    file: 'post-korean-basics.html'
  },
  // Add new posts above (newest first)
];

// Category list (displayed in sidebar)
const CATEGORIES = ['Travel Guide', 'Living in Korea', 'Learn Korean'];
