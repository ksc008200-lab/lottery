#!/usr/bin/env node
/**
 * KR Guide — Homepage Deploy Script
 *
 * Fetches recent posts, builds premium homepage HTML, deploys to WordPress.
 *
 * Usage:
 *   WP_USERNAME=admin WP_APP_PASSWORD="xxxx xxxx xxxx" WP_URL=https://krguide.com node deploy-homepage.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const WP_URL   = (process.env.WP_URL   || 'https://krguide.com').replace(/\/$/, '');
const WP_USER  = process.env.WP_USERNAME;
const WP_PASS  = process.env.WP_APP_PASSWORD;

if (!WP_USER || !WP_PASS) {
  console.error('Error: WP_USERNAME and WP_APP_PASSWORD environment variables are required.');
  console.error('Usage: WP_USERNAME=admin WP_APP_PASSWORD="xxxx xxxx" node deploy-homepage.js');
  process.exit(1);
}

const AUTH = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64');

const CAT_LABELS = { '2': 'Travel Guide', '3': 'Living in Korea', '4': 'Learn Korean' };

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${AUTH}`,
        ...(options.headers || {}),
      },
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function get(url) { return request(url); }
function post(url, body) { return request(url, { method: 'POST' }, body); }

// ── Build article cards HTML ──────────────────────────────────────────────────

function buildArticleCards(posts) {
  if (!posts || posts.length === 0) {
    return '<div class="krg-article-placeholder">New articles coming soon — check back soon!</div>';
  }

  return posts.map(post => {
    const catId   = String(post.categories?.[0] || 2);
    const catLabel = CAT_LABELS[catId] || 'Guide';
    const rawExcerpt = post.excerpt?.rendered || '';
    const excerpt = rawExcerpt.replace(/<[^>]*>/g, '').trim().slice(0, 180);
    const postUrl = `${WP_URL}/${post.slug}/`;
    const title   = post.title?.rendered || '';

    return `<a href="${postUrl}" class="krg-article-card">
  <div class="krg-article-card-body">
    <div class="krg-article-cat">${catLabel}</div>
    <h3 class="krg-article-title">${title}</h3>
    <p class="krg-article-excerpt">${excerpt}</p>
    <span class="krg-article-link">Read More &#x2192;</span>
  </div>
</a>`;
  }).join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nKR Guide Homepage Deploy\n${'─'.repeat(40)}`);
  console.log(`Target: ${WP_URL}`);

  // 1. Fetch recent posts
  console.log('\n[1/4] Fetching recent posts...');
  const postsRes = await get(
    `${WP_URL}/wp-json/wp/v2/posts?per_page=6&_fields=id,title,excerpt,slug,categories`
  );
  if (postsRes.status !== 200) {
    throw new Error(`Failed to fetch posts: HTTP ${postsRes.status}\n${postsRes.body}`);
  }
  const posts = JSON.parse(postsRes.body);
  console.log(`   Found ${posts.length} posts`);
  posts.forEach(p => console.log(`   - [${p.id}] ${p.title.rendered}`));

  // 2. Build homepage content
  console.log('\n[2/4] Building homepage HTML...');
  const templatePath = path.join(__dirname, 'gutenberg-homepage.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const articleCards = buildArticleCards(posts);

  // Add article card CSS styles inline before injecting cards
  const articleCardStyles = `<!-- wp:html -->
<style>
.krg-article-card {
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 16px rgba(15,23,42,0.07);
  border: 1px solid rgba(15,23,42,0.06);
  text-decoration: none;
  color: inherit;
  transition: transform 0.25s, box-shadow 0.25s;
}
.krg-article-card:hover { transform: translateY(-5px); box-shadow: 0 14px 40px rgba(15,23,42,0.12); }
.krg-article-card-body { padding: 24px; flex: 1; display: flex; flex-direction: column; }
.krg-article-cat {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #e8a020;
  margin-bottom: 10px;
}
.krg-article-title {
  font-size: 1.02rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 10px;
  line-height: 1.4;
}
.krg-article-excerpt {
  font-size: 0.88rem;
  color: #64748b;
  line-height: 1.7;
  text-align: justify;
  flex: 1;
  margin: 0;
}
.krg-article-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  color: #e8a020;
  font-size: 0.85rem;
  font-weight: 700;
}
</style>
<!-- /wp:html -->

`;

  // Inject article card styles + cards into template
  const homeContent = articleCardStyles + template.replace('{{RECENT_POSTS}}', articleCards);
  console.log(`   Template size: ${Math.round(homeContent.length / 1024)}KB`);

  // 3. Find or create the "home" page
  console.log('\n[3/4] Deploying to WordPress...');
  const pagesRes = await get(
    `${WP_URL}/wp-json/wp/v2/pages?slug=home&_fields=id,slug,status`
  );
  let pageId;

  if (pagesRes.status === 200) {
    const pages = JSON.parse(pagesRes.body);
    if (pages.length > 0) {
      pageId = pages[0].id;
      console.log(`   Updating existing page ID ${pageId} (slug: home)...`);
      const updateRes = await post(
        `${WP_URL}/wp-json/wp/v2/pages/${pageId}`,
        { title: 'Home', content: homeContent, status: 'publish' }
      );
      if (updateRes.status < 200 || updateRes.status >= 300) {
        throw new Error(`Update page failed: HTTP ${updateRes.status}\n${updateRes.body.slice(0, 400)}`);
      }
      console.log(`   Page updated successfully.`);
    }
  }

  if (!pageId) {
    console.log('   Creating new page (slug: home)...');
    const createRes = await post(
      `${WP_URL}/wp-json/wp/v2/pages`,
      { title: 'Home', slug: 'home', content: homeContent, status: 'publish' }
    );
    if (createRes.status < 200 || createRes.status >= 300) {
      throw new Error(`Create page failed: HTTP ${createRes.status}\n${createRes.body.slice(0, 400)}`);
    }
    const created = JSON.parse(createRes.body);
    pageId = created.id;
    console.log(`   Page created: ID ${pageId}`);
  }

  // 4. Set as static front page
  console.log('\n[4/4] Setting as WordPress front page...');
  const settingsRes = await post(
    `${WP_URL}/wp-json/wp/v2/settings`,
    { show_on_front: 'page', page_on_front: pageId }
  );
  if (settingsRes.status >= 200 && settingsRes.status < 300) {
    console.log('   Front page set successfully.');
  } else {
    console.warn(`   Warning: Settings update returned HTTP ${settingsRes.status}`);
    console.warn(`   You may need to set the front page manually in WordPress > Settings > Reading`);
    console.warn(`   Set "Your homepage displays" to "A static page" and choose "Home"`);
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`✓ Homepage deployed!`);
  console.log(`  Page ID : ${pageId}`);
  console.log(`  URL     : ${WP_URL}/home/`);
  console.log(`  Posts   : ${posts.length} articles injected`);
  console.log(`\nIf the homepage doesn't show, go to:`);
  console.log(`WordPress Admin > Settings > Reading`);
  console.log(`Set "Your homepage displays" → Static page → Homepage: Home`);
}

main().catch(err => {
  console.error('\nDeploy failed:', err.message);
  process.exit(1);
});
