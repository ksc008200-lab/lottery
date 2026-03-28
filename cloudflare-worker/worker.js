/*
[중요 경고]
이 코드는 MV COMPANY(엠브이 주식회사)_거북이버프가 누구나 동일하게 사용할 수 있도록 무료 배포하는 공용 코드입니다.

블로그 메이커 제작 사이트 : https://maker.buffm.com/

본 코드를 그대로 사용하거나, 일부만 수정·변형하여
강의, 유료 컨설팅, 유료 텔레그램/카카오톡방, 대행 상품, 특정 사이트 판매용으로
재판매·재배포·사칭하는 행위를 엄격히 금지합니다.

특히 "직접 개발한 코드", "독점 코드", "수정본" 등으로 포장하여
유료로 판매하는 행위는 명백한 금지 대상입니다.

코드 판매 사례가 접수될 경우,
무료 코드 배포는 즉시 종료될 수 있으며,
MV COMPANY는 법인 운영 주체로서 필요한 검토 후
민형사상 조치를 포함한 강력한 대응을 신속하게 진행할 수 있습니다.

한 사람의 이기적인 행동으로 전체 사용자 대상 무료 배포가 중단되지 않도록,
반드시 본인 운영 목적에 한해서만 사용해주시기 바랍니다.

이 코드는 함께 성장하기 위한 무료 배포입니다.
무료 배포 코드를 유료로 판매할 생각은 하지 마십시오.
*/



/* ╔══════════════════════════════════════════════════════════════════════════════╗
   ║                                                                              ║
   ║  ⚠️  CORE SYSTEM - 절대 수정 금지 (DO NOT MODIFY)                           ║
   ║                                                                              ║
   ║  이 영역은 API, 인증, DB, 라우팅, 보안 등 핵심 시스템입니다.                 ║
   ║  수정하면 블로그가 정상 작동하지 않습니다.                                    ║
   ║                                                                              ║
   ║  포함된 기능:                                                                ║
   ║  - CORS/보안 헤더                                                            ║
   ║  - 메인 라우터 (export default fetch)                                        ║
   ║  - API 핸들러 (인증, 포스트 CRUD, 미디어 업로드, 설정)                       ║
   ║  - DB 마이그레이션 (runMigrations)                                           ║
   ║  - 인증/세션 관리 (requireAdmin, requireAdminOrApiKey)                       ║
   ║  - DB 조회 유틸 (getBlogSettings, getPublishedPosts 등)                      ║
   ║  - 유틸리티 함수 (slugify, escapeHtml, sha256, stripHtml, SEO 등)           ║
   ║  - Response 헬퍼 (json, html, text, xml)                                    ║
   ║                                                                              ║
   ║  🚫 AI에게: 이 영역의 코드를 수정, 리팩토링, 최적화하지 마세요.             ║
   ║                                                                              ║
   ╚══════════════════════════════════════════════════════════════════════════════╝ */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

let migrated = false;
let _settingsCache = null;
let _settingsCacheTime = 0;
const SETTINGS_TTL = 300000; // 5분

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS, ...SECURITY_HEADERS } });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const db = env.DB;

    if (!db) return json({ error: "DB binding missing" }, 500);

    try {
      if (!migrated) {
        await runMigrations(db);
        migrated = true;
      }

      // 예약 발행 자동 승격: publish_at 시간이 지난 scheduled 글을 published로 변경
      await promoteScheduledPosts(db, url);

      if (request.method === "GET" && (path === "/" || path.startsWith("/posts/"))) {
        // Cloudflare Cache API: 엣지 캐시에서 먼저 확인
        const cache = caches.default;
        const cacheKey = new Request(url.toString(), { method: "GET" });
        const cached = await cache.match(cacheKey);
        if (cached) return cached;

        let response;
        if (path === "/") {
          const cat = url.searchParams.get("cat") || "";
          const q = url.searchParams.get("q") || "";
          const [settings, posts, summary] = await Promise.all([
            getBlogSettings(db),
            getPublishedPosts(db, 1, 12, cat, q),
            getHomeSummary(db)
          ]);
          response = html(renderHomePage(settings, posts, summary, cat, q), 200, {
            "Cache-Control": "public, s-maxage=60, max-age=0, must-revalidate",
          });
        } else {
          const slug = decodeURIComponent(path.replace("/posts/", "")).trim();
          response = await handlePostDetail(db, slug, url);
        }

        // 정상 응답만 캐시 저장
        if (response.status === 200) {
          const resp = response.clone();
          await cache.put(cacheKey, resp);
        }
        return response;
      }

      if (request.method === "GET" && path === "/admin") {
        return html(renderAdminPage());
      }

      if (request.method === "GET" && path.startsWith("/media/")) {
        if (!env.MEDIA) return json({ error: "R2 binding missing" }, 500);
        const key = path.slice(1);
        const object = await env.MEDIA.get(key);
        if (!object) return new Response("Not Found", { status: 404 });
        const headers = new Headers({ ...CORS, ...SECURITY_HEADERS });
        headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        if (object.httpEtag) headers.set("ETag", object.httpEtag);
        return new Response(object.body, { headers });
      }

      if (request.method === "GET" && path === "/robots.txt") {
        const origin = `${url.protocol}//${url.host}`;
        return text(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`);
      }

      if (request.method === "GET" && path === "/ads.txt") {
        const settings = await getBlogSettings(db);
        const adsCode = settings.adsense_code || "";
        const pubMatch = adsCode.match(/ca-pub-(\d+)/);
        if (pubMatch) {
          return text(`google.com, pub-${pubMatch[1]}, DIRECT, f08c47fec0942fa0`);
        }
        return text("", 404);
      }

      // IndexNow 키 파일 서빙 (/{key}.txt)
      if (request.method === "GET" && path.endsWith(".txt") && path !== "/robots.txt" && path !== "/ads.txt") {
        const settings = await getBlogSettings(db);
        const inKey = settings.indexnow_key || "";
        if (inKey && path === "/" + inKey + ".txt") {
          return text(inKey);
        }
      }

      if (request.method === "GET" && path === "/sitemap.xml") {
        return handleSitemap(db, url);
      }

      if (request.method === "GET" && path === "/rss.xml") {
        return handleRss(db, url);
      }

      if (path.startsWith("/api/")) {
        return handleApi(request, env, url);
      }

      return html(renderNotFoundPage(), 404);
    } catch (e) {
      return json({ error: "server_error", detail: String(e?.message || e) }, 500);
    }
  },
};

async function handleApi(request, env, url) {
  const db = env.DB;
  const path = url.pathname;
  const method = request.method;

  if (method === "POST" && path === "/api/auth/login") {
    const body = await safeJson(request);
    const password = String(body?.password || "");
    const settings = await getBlogSettings(db);

    const savedHash = settings.admin_password_hash || "";
    const envHash = env.ADMIN_PASSWORD_HASH || "";
    const envPlain = env.ADMIN_PASSWORD || "";

    let ok = false;
    // 운영 편의: Worker Secret을 최우선으로 사용
    if (envPlain) ok = password === envPlain;
    else if (envHash) ok = (await sha256(password)) === envHash;
    else if (savedHash) ok = (await sha256(password)) === savedHash;

    if (!ok) return json({ error: "invalid password" }, 401);

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    await db
      .prepare("INSERT INTO sessions (id, token, role, expires_at, created_at) VALUES (?, ?, 'admin', ?, datetime('now'))")
      .bind(randomId(), token, expiresAt)
      .run();

    return json({ success: true, token, expires_at: expiresAt });
  }

  if (method === "POST" && path === "/api/auth/logout") {
    const token = bearerToken(request);
    if (token) await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return json({ success: true });
  }

  if (method === "GET" && path === "/api/settings") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    return json({ success: true, settings: await getBlogSettings(db) });
  }

  if (method === "PUT" && path === "/api/settings") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;

    const body = await safeJson(request);
    const allowedKeys = [
      "blog_name",
      "blog_description",
      "profile_name",
      "profile_image",
      "theme_color",
      "font_family",
      "font_size_px",
      "adsense_code",
      "ad_top_html",
      "ad_mid_html",
      "ad_bottom_html",
      "google_verification",
      "naver_verification",
      "api_key",
      "turtlebuff_api_key",
      "naver_client_id",
      "naver_client_secret",
      "categories",
      "indexnow_key",
    ];

    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        await upsertSetting(db, key, String(body[key] ?? ""));
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, "admin_password")) {
      const next = String(body.admin_password || "").trim();
      if (next.length < 6) return json({ error: "admin_password must be at least 6 chars" }, 400);
      await upsertSetting(db, "admin_password_hash", await sha256(next));
    }

    _settingsCache = null; // 설정 변경 시 캐시 무효화
    await purgePageCache(url); // 설정 변경 시 페이지 엣지 캐시도 퍼지
    return json({ success: true, settings: await getBlogSettings(db) });
  }

  if (method === "GET" && path === "/api/posts") {
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
    const status = String(url.searchParams.get("status") || "published");
    const catFilter = url.searchParams.get("cat") || "";
    const searchFilter = url.searchParams.get("q") || "";

    if (status !== "published") {
      const admin = await requireAdmin(request, db);
      if (!admin.ok) return admin.res;
    }

    const offset = (page - 1) * limit;
    let rows;
    if (status === "published") {
      let sql = "SELECT id, title, slug, excerpt, category, thumbnail, status, views, source, publish_at, created_at, updated_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))";
      const binds = [];
      if (catFilter) { sql += " AND category = ?"; binds.push(catFilter); }
      if (searchFilter) { sql += " AND (INSTR(title, ?) > 0 OR INSTR(excerpt, ?) > 0)"; binds.push(searchFilter, searchFilter); }
      sql += " ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ? OFFSET ?";
      binds.push(limit, offset);
      rows = await db.prepare(sql).bind(...binds).all();
    } else if (status === "scheduled") {
      rows = await db
        .prepare(
          "SELECT id, title, slug, excerpt, category, thumbnail, status, views, source, publish_at, created_at, updated_at FROM posts WHERE status = 'scheduled' AND (publish_at IS NULL OR publish_at > datetime('now')) ORDER BY publish_at ASC LIMIT ? OFFSET ?"
        )
        .bind(limit, offset)
        .all();
    } else {
      rows = await db
        .prepare(
          "SELECT id, title, slug, excerpt, category, thumbnail, status, views, source, publish_at, created_at, updated_at FROM posts WHERE status = ? ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ? OFFSET ?"
        )
        .bind(status, limit, offset)
        .all();
    }

    return json({ success: true, posts: rows.results || [], page, limit });
  }

  if (method === "POST" && path === "/api/posts") {
    const auth = await requireAdminOrApiKey(request, db, env);
    if (!auth.ok) return auth.res;

    const body = await safeJson(request);
    const title = String(body?.title || "").trim();
    const content = extractBodyContent(String(body?.content || "").trim());
    const category = String(body?.category || "").trim();
    const source = String(body?.source || (auth.mode === "api" ? "automation" : "manual"));
    const requestedStatus = normalizePostStatus(body?.status);
    const publishParsed = parsePublishAt(body?.publish_at);
    if (!publishParsed.ok) return json({ error: publishParsed.error }, 400);
    let status = requestedStatus;
    let publishAt = publishParsed.value;
    if (status === "scheduled") {
      if (!publishAt) return json({ error: "publish_at required for scheduled post" }, 400);
      const v = validateScheduleWindow(publishAt);
      if (!v.ok) return json({ error: v.error }, 400);
    } else if (status === "published" && publishAt) {
      const v = validateScheduleWindow(publishAt);
      if (v.ok && new Date(publishAt).getTime() > Date.now() + 30 * 1000) status = "scheduled";
    } else {
      publishAt = null;
    }

    if (!title || !content) return json({ error: "title and content are required" }, 400);

    const meta_description = String(body?.meta_description || "").trim();
    const og_image = String(body?.og_image || "").trim();
    const focus_keyword = String(body?.focus_keyword || "").trim();
    const tags = String(body?.tags || "").trim();
    const rawContent = extractBodyContent(String(body?.content || "").trim());
    const wc = stripHtml(rawContent).length;
    const word_count = body?.word_count || wc;
    const reading_time = body?.reading_time || Math.ceil(wc / 500);

    const slugBase = slugify(String(body?.slug || title));
    const slug = await ensureUniqueSlug(db, slugBase);
    const excerpt = String(body?.excerpt || stripHtml(content).slice(0, 160));
    const thumbnail = String(body?.thumbnail || "").trim();

    const result = await db
      .prepare(
        "INSERT INTO posts (title, slug, content, excerpt, category, thumbnail, status, views, source, publish_at, meta_description, og_image, focus_keyword, tags, reading_time, word_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))"
      )
      .bind(title, slug, content, excerpt, category, thumbnail, status, source, publishAt ? toSqliteDateTime(publishAt) : null, meta_description, og_image, focus_keyword, tags, reading_time, word_count)
      .run();

    const id = result.meta?.last_row_id;
    const created = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    await purgePageCache(url, created?.slug);
    if (status === "published" && created?.slug) {
      const origin = `${url.protocol}//${url.host}`;
      await notifySearchEngines(origin, created.slug, db);
    }
    return json({ success: true, post: created }, 201);
  }

  if (path.startsWith("/api/posts/") && path.endsWith("/export") && method === "GET") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    const idStr = path.replace("/api/posts/", "").replace("/export", "");
    const id = Number(idStr);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);
    const post = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    if (!post) return json({ error: "not found" }, 404);

    const settings = await getBlogSettings(db);
    const exported = renderExportHtml(settings, post);
    return new Response(exported, {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(post.slug || "post")}.html"`,
      },
    });
  }

  if (path.startsWith("/api/posts/") && path.endsWith("/optimize") && method === "POST") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    const idStr = path.replace("/api/posts/", "").replace("/optimize", "");
    const id = Number(idStr);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);

    const post = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    if (!post) return json({ error: "not found" }, 404);

    const body = await safeJson(request);
    const keyword = String(body?.keyword || "").trim();
    if (!keyword) return json({ error: "keyword required" }, 400);

    const report = buildSeoReport(post.title, post.content, keyword);
    const optimizedTitle = optimizeTitle(post.title, keyword);
    const optimizedContent = optimizeContent(post.content, keyword);

    await db
      .prepare("UPDATE posts SET title = ?, content = ?, excerpt = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(optimizedTitle, optimizedContent, stripHtml(optimizedContent).slice(0, 160), id)
      .run();

    const updated = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    return json({ success: true, report, post: updated, applied: true });
  }

  if (method === "POST" && path === "/api/seo/analyze") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;

    const body = await safeJson(request);
    const title = String(body?.title || "").trim();
    const content = String(body?.content || "").trim();
    const keyword = String(body?.keyword || "").trim();

    if (!title || !content || !keyword) return json({ error: "title, content, keyword required" }, 400);

    const localReport = buildSeoReport(title, content, keyword);
    const naverStats = await checkNaverKeywordCount(db, env, keyword);

    return json({ success: true, local: localReport, naver: naverStats });
  }

  if (method === "GET" && path === "/api/stats") {
    const admin = await requireAdmin(request, db);
    if (!admin.ok) return admin.res;
    const totalPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts").first();
    const publishedPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))").first();
    const scheduledPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts WHERE status='scheduled' AND (publish_at IS NULL OR publish_at > datetime('now'))").first();
    const draftPosts = await db.prepare("SELECT COUNT(*) as cnt FROM posts WHERE status='draft'").first();
    const totalViews = await db.prepare("SELECT COALESCE(SUM(views),0) as total FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))").first();
    const topPosts = await db.prepare("SELECT id, title, slug, views, publish_at, created_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY views DESC LIMIT 10").all();
    const recentPosts = await db.prepare("SELECT id, title, status, created_at FROM posts ORDER BY created_at DESC LIMIT 10").all();
    const catStats = await db.prepare("SELECT COALESCE(category,'미분류') as category, COUNT(*) as cnt, COALESCE(SUM(views),0) as views FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) GROUP BY category ORDER BY cnt DESC").all();
    return json({
      success: true,
      stats: {
        total_posts: totalPosts?.cnt || 0,
        published_posts: publishedPosts?.cnt || 0,
        scheduled_posts: scheduledPosts?.cnt || 0,
        draft_posts: draftPosts?.cnt || 0,
        total_views: totalViews?.total || 0,
        top_posts: topPosts?.results || [],
        recent_posts: recentPosts?.results || [],
        category_stats: catStats?.results || []
      }
    });
  }

  if (method === "POST" && path === "/api/media/upload") {
    const auth = await requireAdminOrApiKey(request, db, env);
    if (!auth.ok) return auth.res;
    if (!env.MEDIA) return json({ error: "R2 binding (MEDIA) missing" }, 500);
    const ct = request.headers.get("Content-Type") || "";
    if (!ct.includes("multipart/form-data")) return json({ error: "multipart/form-data required" }, 400);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return json({ error: "file field required" }, 400);
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) return json({ error: "unsupported image type: " + file.type }, 400);
    if (file.size > 10 * 1024 * 1024) return json({ error: "file too large (max 10MB)" }, 400);
    const ext = (file.name || "img").split(".").pop() || "jpg";
    const key = "media/" + Date.now() + "-" + randomId().slice(0, 8) + "." + ext;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    const imageUrl = "/" + key;
    return json({ success: true, url: imageUrl, html: `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" />`, key });
  }

  if (method === "POST" && path === "/api/media/url") {
    const auth = await requireAdminOrApiKey(request, db, env);
    if (!auth.ok) return auth.res;
    const body = await safeJson(request);
    const raw = String(body?.url || "").trim();
    if (!raw) return json({ error: "url required" }, 400);

    const type = detectUrlType(raw);
    if (type === "image") {
      const htmlSnippet = `<img src="${escapeHtml(raw)}" alt="" loading="lazy" />`;
      return json({ success: true, type, html: htmlSnippet });
    }
    if (type === "video") {
      const htmlSnippet = videoEmbedHtml(raw);
      return json({ success: true, type, html: htmlSnippet });
    }
    return json({ success: true, type: "link", html: `<a href="${escapeHtml(raw)}" target="_blank" rel="noopener noreferrer">${escapeHtml(raw)}</a>` });
  }

  if (path.startsWith("/api/posts/")) {
    const id = parseInt(path.replace("/api/posts/", ""), 10);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);

    if (method === "GET") {
      const post = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
      if (!post) return json({ error: "not found" }, 404);
      if (!(post.status === "published" || post.status === "scheduled")) {
        const admin = await requireAdmin(request, db);
        if (!admin.ok) return admin.res;
      } else if (post.status === "scheduled" && post.publish_at && new Date(post.publish_at).getTime() > Date.now()) {
        const admin = await requireAdmin(request, db);
        if (!admin.ok) return admin.res;
      }
      return json({ success: true, post });
    }

    if (method === "PUT") {
      const admin = await requireAdmin(request, db);
      if (!admin.ok) return admin.res;

      const current = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
      if (!current) return json({ error: "not found" }, 404);

      const body = await safeJson(request);
      const title = body?.title !== undefined ? String(body.title).trim() : current.title;
      const content = body?.content !== undefined ? extractBodyContent(String(body.content).trim()) : current.content;
      const excerpt = body?.excerpt !== undefined ? String(body.excerpt).trim() : current.excerpt;
      const category = body?.category !== undefined ? String(body.category).trim() : current.category;
      const thumbnail = body?.thumbnail !== undefined ? String(body.thumbnail).trim() : current.thumbnail;
      const requestedStatus = body?.status !== undefined ? normalizePostStatus(body.status) : current.status;
      const publishRaw = body?.publish_at !== undefined ? body.publish_at : current.publish_at;
      const publishParsed = parsePublishAt(publishRaw);
      if (!publishParsed.ok) return json({ error: publishParsed.error }, 400);
      let status = requestedStatus;
      let publishAt = publishParsed.value;
      if (status === "scheduled") {
        if (!publishAt) return json({ error: "publish_at required for scheduled post" }, 400);
        const v = validateScheduleWindow(publishAt);
        if (!v.ok) return json({ error: v.error }, 400);
      } else if (status === "published") {
        // 발행으로 명시적 변경 시 publish_at 초기화 (예약→발행 전환 지원)
        publishAt = null;
      } else {
        publishAt = null;
      }
      const meta_description = body?.meta_description !== undefined ? String(body.meta_description).trim() : current.meta_description;
      const og_image = body?.og_image !== undefined ? String(body.og_image).trim() : current.og_image;
      const focus_keyword = body?.focus_keyword !== undefined ? String(body.focus_keyword).trim() : current.focus_keyword;
      const tags = body?.tags !== undefined ? String(body.tags).trim() : current.tags;
      const word_count = body?.word_count !== undefined ? body.word_count : current.word_count;
      const reading_time = body?.reading_time !== undefined ? body.reading_time : current.reading_time;

      let slug = current.slug;

      if (body?.slug !== undefined) {
        const candidate = slugify(String(body.slug || title));
        slug = await ensureUniqueSlug(db, candidate, id);
      } else if (body?.title !== undefined) {
        const candidate = slugify(title);
        slug = await ensureUniqueSlug(db, candidate, id);
      }

      await db
        .prepare(
          "UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, category = ?, thumbnail = ?, status = ?, publish_at = ?, meta_description = ?, og_image = ?, focus_keyword = ?, tags = ?, reading_time = ?, word_count = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(title, slug, content, excerpt || stripHtml(content).slice(0, 160), category, thumbnail, status, publishAt ? toSqliteDateTime(publishAt) : null, meta_description, og_image, focus_keyword, tags, reading_time, word_count, id)
        .run();

      const updated = await db.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
      await purgePageCache(url, updated?.slug, current?.slug);
      if (status === "published" && updated?.slug) {
        const origin = `${url.protocol}//${url.host}`;
        await notifySearchEngines(origin, updated.slug, db);
      }
      return json({ success: true, post: updated });
    }

    if (method === "DELETE") {
      const admin = await requireAdmin(request, db);
      if (!admin.ok) return admin.res;

      // R2 이미지 삭제: content에서 /media/ URL 추출 후 R2에서 제거
      if (env.MEDIA) {
        try {
          const post = await db.prepare("SELECT content, thumbnail FROM posts WHERE id = ?").bind(id).first();
          if (post) {
            const keys = new Set();
            // content 내 /media/ 이미지 추출
            const mediaRe = /\/media\/[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+/g;
            if (post.content) {
              for (const m of post.content.matchAll(mediaRe)) keys.add(m[0].slice(1));
            }
            // thumbnail도 /media/ 경로면 추가
            if (post.thumbnail && post.thumbnail.startsWith("/media/")) {
              keys.add(post.thumbnail.slice(1));
            }
            // R2에서 삭제 (병렬)
            if (keys.size > 0) {
              await Promise.allSettled([...keys].map(k => env.MEDIA.delete(k)));
            }
          }
        } catch (e) {
          console.error("R2 cleanup error:", e);
          // R2 삭제 실패해도 DB 삭제는 진행
        }
      }

      // 캐시 퍼지용 slug 조회
      const delPost = await db.prepare("SELECT slug FROM posts WHERE id = ?").bind(id).first();
      await db.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
      await purgePageCache(url, delPost?.slug);
      return json({ success: true });
    }
  }

  // 조회수 조회 API (GET: 조회만, POST: 증가+조회)
  if (path.match(/^\/api\/posts\/\d+\/view$/)) {
    const id = parseInt(path.replace("/api/posts/", "").replace("/view", ""), 10);
    if (!Number.isFinite(id)) return json({ error: "invalid id" }, 400);
    if (method === "POST") {
      await db.prepare("UPDATE posts SET views = COALESCE(views, 0) + 1 WHERE id = ?").bind(id).run();
    }
    const row = await db.prepare("SELECT views FROM posts WHERE id = ?").bind(id).first();
    return json({ success: true, views: Number(row?.views || 0) });
  }

  return json({ error: "not_found" }, 404);
}

async function handlePostDetail(db, slug, url) {
  const post = await db
    .prepare("SELECT * FROM posts WHERE slug = ? AND (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) LIMIT 1")
    .bind(slug)
    .first();

  if (!post) return html(renderNotFoundPage(), 404);

  const origin = `${url.protocol}//${url.host}`;
  const [settings, relatedPosts] = await Promise.all([
    getBlogSettings(db),
    getRelatedPosts(db, post.id, post.category, 3)
  ]);
  return html(renderPostPage(settings, post, relatedPosts, origin), 200, { "Cache-Control": "public, s-maxage=3600, max-age=0, must-revalidate" });
}

async function getRelatedPosts(db, currentId, category, limit) {
  if (!category) return [];
  const rows = await db
    .prepare("SELECT id, title, slug, excerpt, thumbnail, category, publish_at, created_at FROM posts WHERE category = ? AND id != ? AND (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ?")
    .bind(category, currentId, limit)
    .all();
  return rows.results || [];
}

async function handleSitemap(db, url) {
  const origin = `${url.protocol}//${url.host}`;
  const rows = await db
    .prepare("SELECT slug, updated_at, created_at, publish_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY COALESCE(publish_at, created_at) DESC")
    .all();

  const now = formatKSTDate(new Date().toISOString());
  const homePage = `<url><loc>${escapeXml(origin)}/</loc><lastmod>${escapeXml(now)}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`;
  const items = (rows.results || [])
    .map((p) => {
      const dt = formatKSTDate(p.updated_at || p.publish_at || p.created_at);
      return `<url><loc>${escapeXml(origin + "/posts/" + p.slug)}</loc><lastmod>${escapeXml(dt)}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`;
    })
    .join("");

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${homePage}${items}</urlset>`;
  return new Response(xmlContent, { headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}

async function handleRss(db, url) {
  const origin = `${url.protocol}//${url.host}`;
  const settings = await getBlogSettings(db);
  const rows = await db
    .prepare("SELECT title, slug, excerpt, publish_at, created_at FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now'))) ORDER BY COALESCE(publish_at, created_at) DESC LIMIT 30")
    .all();

  const items = (rows.results || [])
    .map((p) => {
      const link = `${origin}/posts/${p.slug}`;
      return [
        "<item>",
        `<title>${escapeXml(p.title || "")}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid>${escapeXml(link)}</guid>`,
        `<description>${escapeXml(p.excerpt || "")}</description>`,
        `<pubDate>${escapeXml(new Date(p.publish_at || p.created_at || Date.now()).toUTCString())}</pubDate>`,
        "</item>",
      ].join("");
    })
    .join("");

  const title = settings.blog_name || "Blog";
  const desc = settings.blog_description || "";
  const rssContent = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${escapeXml(title)}</title><link>${escapeXml(origin)}</link><description>${escapeXml(desc)}</description>${items}</channel></rss>`;
  return new Response(rssContent, { headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

async function runMigrations(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT UNIQUE, content TEXT, excerpt TEXT, category TEXT, thumbnail TEXT, status TEXT DEFAULT 'draft', views INTEGER DEFAULT 0, source TEXT DEFAULT 'manual', publish_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) )"
  ).run();
  try {
    await db.prepare("ALTER TABLE posts ADD COLUMN publish_at TEXT").run();
  } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN meta_description TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN og_image TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN focus_keyword TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN tags TEXT").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN reading_time INTEGER DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE posts ADD COLUMN word_count INTEGER DEFAULT 0").run(); } catch {}

  await db.prepare("CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_posts_publish_at ON posts(publish_at)").run();

  await db.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token TEXT UNIQUE, role TEXT, expires_at TEXT, created_at TEXT DEFAULT (datetime('now'))) ").run();

  const defaults = {
    blog_name: "관리자 - 설정 - 블로그 이름 바꿔주세요",
    blog_description: "관리자 - 설정 - 블로그 설명 바꿔주세요",
    profile_name: "관리자 - 설정 - 이름 바꿔주세요",
    profile_image: "",
    theme_color: "#111111",
    font_family: "",
    font_size_px: "18",
    adsense_code: "",
    ad_top_html: "",
    ad_mid_html: "",
    ad_bottom_html: "",
    google_verification: "",
    naver_verification: "",
    api_key: randomToken(),
    turtlebuff_api_key: randomToken(),
    naver_client_id: "",
    naver_client_secret: "",
    categories: "복지정책",
    indexnow_key: randomToken(),
  };

  for (const [k, v] of Object.entries(defaults)) {
    await db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").bind(k, v).run();
  }

  // 기존 글 excerpt 재생성 (CSS 텍스트 오염 수정)
  try {
    const rows = await db.prepare("SELECT id, content FROM posts WHERE excerpt LIKE '%.hero-img%' OR excerpt LIKE '%margin:%' OR excerpt LIKE '%border-radius%'").all();
    for (const row of (rows.results || [])) {
      const newExcerpt = stripHtml(row.content || "").slice(0, 160);
      await db.prepare("UPDATE posts SET excerpt = ? WHERE id = ?").bind(newExcerpt, row.id).run();
    }
  } catch {}
}

async function requireAdmin(request, db) {
  const token = bearerToken(request);
  if (!token) return { ok: false, res: json({ error: "unauthorized" }, 401) };

  const session = await db
    .prepare("SELECT token, expires_at FROM sessions WHERE token = ? AND role = 'admin' LIMIT 1")
    .bind(token)
    .first();

  if (!session) return { ok: false, res: json({ error: "unauthorized" }, 401) };
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
    return { ok: false, res: json({ error: "session expired" }, 401) };
  }
  return { ok: true };
}

async function requireAdminOrApiKey(request, db, env) {
  const admin = await requireAdmin(request, db);
  if (admin.ok) return { ok: true, mode: "admin" };

  const apiKey = request.headers.get("X-API-Key") || "";
  if (!apiKey) return { ok: false, res: json({ error: "unauthorized" }, 401) };

  const settings = await getBlogSettings(db);
  const valid = [settings.api_key, settings.turtlebuff_api_key, env.TURTLEBUFF_API_KEY].filter(Boolean);
  if (valid.includes(apiKey)) return { ok: true, mode: "api" };
  return { ok: false, res: json({ error: "invalid api key" }, 401) };
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return "";
  return auth.slice(7).trim();
}

async function purgePageCache(url, ...slugs) {
  try {
    const cache = caches.default;
    const origin = `${url.protocol}//${url.host}`;
    // 홈, 아카이브 캐시 삭제
    await cache.delete(new Request(origin + "/", { method: "GET" }));

    // 해당 글 캐시 삭제
    for (const slug of slugs) {
      if (slug) await cache.delete(new Request(origin + "/posts/" + slug, { method: "GET" }));
    }
  } catch (e) {
    // 캐시 퍼지 실패해도 무시
  }
}

async function notifySearchEngines(origin, slugOrUrl, db) {
  try {
    const settings = await getBlogSettings(db);
    const key = settings.indexnow_key || "";
    const pageUrl = slugOrUrl.startsWith("http") ? slugOrUrl : origin + "/posts/" + slugOrUrl;
    // IndexNow (Bing, Yandex, Naver 등)
    if (key) {
      const res = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: new URL(origin).host, key, keyLocation: origin + "/" + key + ".txt", urlList: [pageUrl] })
      });
      const msg = {200:"OK",202:"Accepted",400:"Bad request",403:"Key invalid",422:"URL/host mismatch",429:"Too many requests"};
      console.log("[IndexNow] " + res.status + " " + (msg[res.status]||"Unknown") + " → " + pageUrl);
    }
  } catch (e) {
    // 인덱싱 알림 실패해도 무시
  }
}

async function promoteScheduledPosts(db, url) {
  try {
    // 승격 대상 slug 먼저 조회
    const targets = await db.prepare("SELECT slug FROM posts WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')").all();
    if (!targets.results || targets.results.length === 0) return;
    await db
      .prepare(
        "UPDATE posts SET status = 'published', updated_at = datetime('now') WHERE status = 'scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')"
      )
      .run();
    // 승격된 글들에 대해 검색엔진 알림
    if (url) {
      const origin = `${url.protocol}//${url.host}`;
      for (const p of targets.results) {
        if (p.slug) await notifySearchEngines(origin, p.slug, db);
      }
    }
  } catch (e) {
    // 승격 실패해도 요청 처리는 계속 진행
  }
}

async function getBlogSettings(db) {
  if (_settingsCache && Date.now() - _settingsCacheTime < SETTINGS_TTL) return _settingsCache;
  const rows = await db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  for (const r of rows.results || []) out[r.key] = r.value;
  _settingsCache = out;
  _settingsCacheTime = Date.now();
  return out;
}

async function upsertSetting(db, key, value) {
  await db
    .prepare("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value)
    .run();
}

async function getPublishedPosts(db, page, limit, category, search) {
  const offset = (Math.max(1, page) - 1) * Math.max(1, limit);
  let sql = "SELECT id, title, slug, excerpt, category, thumbnail, publish_at, created_at, views FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))";
  const binds = [];
  if (category) {
    sql += " AND category = ?";
    binds.push(category);
  }
  if (search) {
    sql += " AND (INSTR(title, ?) > 0 OR INSTR(excerpt, ?) > 0)";
    binds.push(search, search);
  }
  sql += " ORDER BY COALESCE(publish_at, created_at) DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);
  const rows = await db.prepare(sql).bind(...binds).all();
  return rows.results || [];
}

async function getHomeSummary(db) {
  const published = await db
    .prepare("SELECT COUNT(*) as cnt FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))")
    .first();
  const views = await db
    .prepare("SELECT COALESCE(SUM(views),0) as total FROM posts WHERE (status='published' OR (status='scheduled' AND publish_at IS NOT NULL AND publish_at <= datetime('now')))")
    .first();
  return {
    published_posts: Number(published?.cnt || 0),
    total_views: Number(views?.total || 0),
  };
}

async function ensureUniqueSlug(db, base, selfId) {
  const clean = base || "post";
  let candidate = clean;
  let seq = 2;
  while (true) {
    const row = await db.prepare("SELECT id FROM posts WHERE slug = ? LIMIT 1").bind(candidate).first();
    if (!row || (selfId && Number(row.id) === Number(selfId))) return candidate;
    candidate = `${clean}-${seq}`;
    seq += 1;
  }
}

function slugify(input) {
  // 한글/영문/숫자 포함 slug 생성
  const slug = String(input || "")
    .trim()
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (slug) return slug;
  // 빈 경우: 타임스탬프 기반
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `p-${ts}-${rand}`;
}

function extractBodyContent(input) {
  const c = String(input || "").trim();
  if (!/^<!doctype\s|^<html[\s>]/i.test(c)) return c;
  const styleBlocks = Array.from(c.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi))
    .map((m) => m[0])
    .join("\n");

  const bodyMatch = c.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = "";
  if (bodyMatch) {
    body = bodyMatch[1].trim();
  } else {
    const afterHead = c.replace(/^[\s\S]*?<\/head>/i, "");
    body = afterHead
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<\/?body[^>]*>/gi, "")
      .replace(/^<!doctype[^>]*>/i, "")
      .trim();
  }

  const cleaned = body.replace(/<script[\s\S]*?<\/script>/gi, "").trim();
  if (!styleBlocks) return cleaned;
  return `${styleBlocks}\n${cleaned}`.trim();
}

function normalizePostStatus(raw) {
  const v = String(raw || "published").toLowerCase().trim();
  if (v === "draft") return "draft";
  if (v === "scheduled") return "scheduled";
  return "published";
}

function parsePublishAt(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return { ok: true, value: null };
  const dt = new Date(String(raw).trim());
  if (!Number.isFinite(dt.getTime())) return { ok: false, error: "invalid publish_at datetime" };
  return { ok: true, value: dt.toISOString() };
}

function validateScheduleWindow(publishAtIso) {
  const ts = new Date(publishAtIso).getTime();
  if (!Number.isFinite(ts)) return { ok: false, error: "invalid publish_at datetime" };
  const now = Date.now();
  const max = now + 50 * 24 * 60 * 60 * 1000;
  if (ts < now + 30 * 1000) return { ok: false, error: "publish_at must be in the future" };
  if (ts > max) return { ok: false, error: "publish_at exceeds 50 days limit" };
  return { ok: true };
}

function toSqliteDateTime(iso) {
  return String(iso || "").replace("T", " ").slice(0, 19);
}

function formatKSTDate(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(' ', 'T');
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
  if (!Number.isFinite(d.getTime())) return String(dateStr).slice(0, 10);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function formatKSTDateTime(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).replace(' ', 'T');
  const d = new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
  if (!Number.isFinite(d.getTime())) return String(dateStr).slice(0, 16).replace('T', ' ');
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16).replace('T', ' ');
}

function stripHtml(input) {
  return String(input || "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#\d+;/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(s) {
  return escapeHtml(s);
}

function randomToken() {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomId() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(text) {
  const enc = new TextEncoder().encode(String(text || ""));
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function detectUrlType(raw) {
  const s = String(raw || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(s)) return "image";
  if (s.includes("youtube.com") || s.includes("youtu.be") || s.includes("vimeo.com")) return "video";
  return "link";
}

function videoEmbedHtml(raw) {
  const u = String(raw || "");
  const yt = u.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (yt) {
    const id = yt[1];
    return `<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${escapeHtml(id)}" title="video" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
  }
  return `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u)}</a>`;
}

function keywordDensity(text, keyword) {
  const t = stripHtml(text).toLowerCase();
  const k = String(keyword || "").toLowerCase().trim();
  if (!t || !k) return 0;
  const words = t.split(/\s+/).filter(Boolean).length || 1;
  const matches = (t.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  return Number(((matches / words) * 100).toFixed(2));
}

function buildSeoReport(title, content, keyword) {
  const titleLen = String(title || "").length;
  const textLen = stripHtml(content).length;
  const density = keywordDensity(content, keyword);
  const hasKeywordInTitle = String(title || "").toLowerCase().includes(String(keyword || "").toLowerCase());

  const suggestions = [];
  if (!hasKeywordInTitle) suggestions.push("제목에 핵심 키워드를 1회 포함하세요.");
  if (titleLen < 18 || titleLen > 42) suggestions.push("제목 길이를 18~42자로 조정하세요.");
  if (textLen < 1200) suggestions.push("본문 길이를 최소 1200자 이상으로 늘리세요.");
  if (density < 0.4) suggestions.push("키워드 언급 빈도가 낮습니다. 자연스럽게 2~4회 추가하세요.");
  if (density > 2.5) suggestions.push("키워드 과다 사용입니다. 일부를 유의어로 치환하세요.");

  const scoreBase = 100
    - (hasKeywordInTitle ? 0 : 20)
    - (titleLen < 18 || titleLen > 42 ? 10 : 0)
    - (textLen < 1200 ? 20 : 0)
    - (density < 0.4 || density > 2.5 ? 15 : 0);

  return {
    score: Math.max(10, scoreBase),
    title_length: titleLen,
    body_length: textLen,
    keyword_density_percent: density,
    has_keyword_in_title: hasKeywordInTitle,
    suggestions,
  };
}

function optimizeTitle(title, keyword) {
  const t = String(title || "").trim();
  const k = String(keyword || "").trim();
  if (!k) return t;
  if (t.toLowerCase().includes(k.toLowerCase())) return t;
  return `${k} | ${t}`.slice(0, 60);
}

function optimizeContent(content, keyword) {
  const c = String(content || "");
  const k = String(keyword || "").trim();
  if (!k) return c;
  const plain = stripHtml(c).toLowerCase();
  if (plain.includes(k.toLowerCase())) return c;
  return `<p><strong>${escapeHtml(k)}</strong> 관련 핵심 내용을 먼저 요약합니다.</p>\n` + c;
}

async function checkNaverKeywordCount(db, env, keyword) {
  const settings = await getBlogSettings(db);
  const all = [];
  if (settings.naver_client_id && settings.naver_client_secret) {
    all.push({ id: settings.naver_client_id, secret: settings.naver_client_secret });
  }
  try {
    const envApis = JSON.parse(env.NAVER_APIS || "[]");
    if (Array.isArray(envApis)) all.push(...envApis);
  } catch {}

  if (!all.length) {
    return { ok: false, message: "네이버 API 키 미설정", result_count: null };
  }

  const pick = all[Math.floor(Math.random() * all.length)];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(keyword)}&display=10&sort=sim`,
      {
        headers: {
          "X-Naver-Client-Id": pick.id,
          "X-Naver-Client-Secret": pick.secret,
        },
      }
    );
    const data = await res.json();
    return {
      ok: res.ok,
      message: res.ok ? "조회 성공" : "조회 실패",
      result_count: Number(data?.total || 0),
      sample_titles: (data?.items || []).slice(0, 3).map((x) => stripHtml(x.title || "")),
    };
  } catch (e) {
    return { ok: false, message: String(e?.message || e), result_count: null };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function html(content, status = 200, extra = {}) {
  return new Response(content, {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "text/html; charset=utf-8", ...extra },
  });
}

function text(content, status = 200) {
  return new Response(content, {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

function xml(content, status = 200) {
  return new Response(content, {
    status,
    headers: { ...CORS, ...SECURITY_HEADERS, "Content-Type": "application/xml; charset=utf-8" },
  });
}

/* ╔══════════════════════════════════════════════════════════════════════════════╗
   ║  🔒 CORE SYSTEM 영역 끝 (END OF CORE SYSTEM)                               ║
   ║  ⚠️ 위의 모든 코드는 수정하지 마세요                                        ║
   ╚══════════════════════════════════════════════════════════════════════════════╝ */

/* ╔══════════════════════════════════════════════════════════════════════════════╗
   ║                                                                              ║
   ║  🎨  CUSTOMIZABLE ZONE - 자유롭게 수정 가능                                 ║
   ║                                                                              ║
   ║  이 영역의 HTML, CSS, 레이아웃, 색상, 폰트 등을 자유롭게 수정하세요.         ║
   ║                                                                              ║
   ║  ⚠️ 주의사항:                                                               ║
   ║  - 함수 이름과 파라미터(매개변수)는 절대 변경하지 마세요                      ║
   ║  - return 값의 기본 구조(HTML 문자열)는 유지하세요                            ║
   ║  - settings, posts 등 데이터 객체의 속성명은 변경 불가                        ║
   ║  - escapeHtml() 등 보안 함수 호출은 제거하지 마세요                           ║
   ║                                                                              ║
   ║  수정 가능한 함수 목록:                                                      ║
   ║  - renderHomePage()     : 홈페이지 (카드 레이아웃, 사이드바)                  ║
   ║  - (아카이브 페이지 제거됨)                                                    ║
   ║  - renderPostPage()     : 글 상세 페이지                                     ║
   ║  - injectMidAd()        : 본문 중간 광고 삽입 위치                            ║
   ║  - renderExportHtml()   : HTML 내보내기 템플릿                                ║
   ║  - renderAdminPage()    : 관리자 대시보드 (에디터, 설정, 통계)                ║
   ║  - renderNotFoundPage() : 404 페이지                                         ║
   ║                                                                              ║
   ╚══════════════════════════════════════════════════════════════════════════════╝ */

/* ──── 🎨 [수정 가능] 홈페이지 ────────────────────────────────────────────────
   CSS 스타일, 카드 레이아웃, 색상, 폰트, 사이드바 등을 자유롭게 변경하세요.
   ⚠️ 함수명 renderHomePage(settings, posts, summary, activeCat, searchQuery) 유지 필수
   ⚠️ settings, posts, summary 데이터 속성명 변경 불가
   사용 가능한 데이터:
     settings: blog_name, blog_description, profile_name, profile_image, categories, theme_color, ...
     posts[]: id, title, slug, excerpt, category, thumbnail, publish_at, created_at, views
     summary: published_posts, total_views
     activeCat: 현재 선택된 카테고리 (문자열 또는 빈값)
     searchQuery: 검색어 (문자열 또는 빈값)
   ────────────────────────────────────────────────────────────────────────────── */
function renderHomePage(settings, posts, summary, activeCat, searchQuery) {
  const title = settings.blog_name || "Blog";
  const desc = settings.blog_description || "";
  const profileName = settings.profile_name || "Admin";
  const profileImage = settings.profile_image || "";
  const ogImage = profileImage || (posts.length && posts[0].thumbnail ? posts[0].thumbnail : "");
  const cats = (settings.categories || "").split(",").map(c => c.trim()).filter(Boolean);

  const cards = posts.length
    ? posts
        .map(
          (p, i) => {
            const cleanExcerpt = stripHtml(p.excerpt || "").slice(0, 80);
            return `
      <article class="card" style="animation-delay:${Math.min(i * 0.04, 0.28)}s">
        <a href="/posts/${escapeHtml(p.slug)}" class="card-link">
          <div class="thumb">${p.thumbnail ? `<img src="${escapeHtml(p.thumbnail)}" alt="${escapeHtml(p.title)}" width="741" height="413" ${i === 0 ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} />` : `<div class="thumb-empty"></div>`}</div>
          <div class="card-body">
            <h3>${escapeHtml(p.title)}</h3>
            <p class="excerpt">${escapeHtml(cleanExcerpt)}</p>
            <div class="meta"><span class="cat">${escapeHtml(p.category || "일반")}</span><span class="dot"></span>${escapeHtml(formatKSTDate(p.publish_at || p.created_at))}</div>
          </div>
        </a>
        <div class="admin-tools" data-admin><a href="/admin#edit-${p.id}">수정</a><button class="del" onclick="event.stopPropagation();if(!confirm('이 글을 삭제하시겠습니까?'))return;fetch('/api/posts/${p.id}',{method:'DELETE',headers:{'Authorization':'Bearer '+localStorage.getItem('admin_token')}}).then(r=>r.json()).then(d=>{if(d.success)location.reload();else alert('삭제 실패: '+(d.error||''))}).catch(e=>alert('삭제 오류: '+e.message))">삭제</button></div>
      </article>`;
          }
        )
        .join("")
    : `<div class="empty">아직 발행된 글이 없습니다.</div>`;

  const catLinks = `<a href="/" class="side-cat${!activeCat?' active':''}">#전체</a>` + cats.map(c => `<a href="/?cat=${encodeURIComponent(c)}" class="side-cat${activeCat===c?' active':''}">${escapeHtml(c)}</a>`).join("");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": title,
    "description": desc,
    "url": "/",
    "blogPost": posts.slice(0, 10).map(p => ({
      "@type": "BlogPosting",
      "headline": p.title,
      "url": "/posts/" + p.slug,
      "datePublished": p.created_at,
      "image": p.thumbnail || "",
      "author": { "@type": "Person", "name": profileName }
    }))
  });

  const adTop = settings.ad_top_html || "";
  const adBottom = settings.ad_bottom_html || "";
  const stats = summary || { published_posts: 0, total_views: 0 };
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<meta name="robots" content="index,follow" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(desc)}" />
<meta property="og:site_name" content="${escapeHtml(title)}" />
<meta property="og:url" content="/" />
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />` : ""}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(desc)}" />
${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : ""}
${settings.google_verification ? `<meta name="google-site-verification" content="${escapeHtml(settings.google_verification)}" />` : ""}
${settings.naver_verification ? `<meta name="naver-site-verification" content="${escapeHtml(settings.naver_verification)}" />` : ""}
<link rel="canonical" href="https://bichonbuff.com/" />
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(title)} RSS" href="/rss.xml" />
<script type="application/ld+json">${jsonLd}</script>

<style>
:root{--bg:#fff;--bg2:#f5f5f7;--card:#fff;--line:#d2d2d7;--line2:#e8e8eb;--muted:#86868b;--txt:#1d1d1f;--accent:#0071e3}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;background:var(--bg);color:var(--txt);-webkit-font-smoothing:antialiased}
/* Header */
.header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}
.header-in{max-width:1200px;margin:0 auto;padding:13px 28px;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;font-size:1.15rem;letter-spacing:-.03em;color:var(--txt);text-decoration:none}.side-cat.active{background:var(--primary,#111);color:#fff}
.nav{display:flex;gap:20px;align-items:center}
.nav a{color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:500;transition:color .15s}
.nav a:hover{color:var(--txt)}
.nav .pill{padding:6px 14px;border-radius:999px;background:var(--txt);color:#fff;font-weight:600;font-size:.8rem}
.nav .pill:hover{opacity:.85;color:#fff}
/* Layout */
.layout{max-width:1200px;margin:0 auto;padding:32px 28px 60px;display:grid;grid-template-columns:220px 1fr;gap:40px}
/* Sidebar */
.sidebar{position:sticky;top:80px;align-self:start}
.profile{text-align:center;margin-bottom:28px}
.profile-img{width:72px;height:72px;border-radius:50%;object-fit:cover;background:var(--bg2);border:1px solid var(--line2)}
.profile-initials{width:72px;height:72px;border-radius:50%;background:var(--txt);color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;margin:0 auto}
.profile-name{margin:10px 0 2px;font-size:.95rem;font-weight:700;letter-spacing:-.02em}
.profile-desc{font-size:.78rem;color:var(--muted);line-height:1.5}
.side-section{margin-bottom:20px}
.side-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;padding-left:2px}
.side-cat{display:block;padding:6px 10px;font-size:.84rem;color:var(--txt);text-decoration:none;border-radius:8px;font-weight:500;transition:background .12s}
.side-cat:hover{background:var(--bg2)}
.side-link{display:block;padding:5px 10px;font-size:.8rem;color:var(--muted);text-decoration:none;font-weight:500;transition:color .12s}
.side-link:hover{color:var(--txt)}
.admin-tools{display:none;gap:5px;padding:0 14px 10px}
.admin-tools a,.admin-tools button{font-size:.72rem;padding:3px 8px;border-radius:6px;text-decoration:none;font-weight:600;border:1px solid var(--line2);color:var(--muted);background:#fff;cursor:pointer}
.admin-tools a:hover,.admin-tools button:hover{background:var(--txt);color:#fff;border-color:var(--txt)}
.admin-tools .del{color:#e53e3e;border-color:#fed7d7}
.admin-tools .del:hover{background:#e53e3e;color:#fff;border-color:#e53e3e}
/* Main */
.main-area h1{font-size:2rem;font-weight:800;letter-spacing:-.04em;margin:0 0 6px}
.main-area .desc{color:var(--muted);font-size:.92rem;margin:0 0 24px;line-height:1.5}
.filter-info{padding:10px 14px;background:var(--bg2);border-radius:10px;font-size:.88rem;color:var(--muted);margin-bottom:14px}.filter-info a{color:var(--txt);font-weight:600;margin-left:8px;text-decoration:none}.filter-info a:hover{text-decoration:underline}
.side-search{display:flex;gap:6px}.side-search input{flex:1;padding:7px 10px;border:1px solid var(--line2);border-radius:8px;font-size:.84rem;outline:none;background:var(--bg2)}.side-search input:focus{border-color:var(--txt)}.side-search button{padding:7px 12px;border:none;border-radius:8px;background:var(--txt);color:#fff;font-size:.8rem;font-weight:600;cursor:pointer}
.visit-strip{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0 0}
.visit-card{border:1px solid var(--line2);border-radius:12px;background:#fff;padding:10px 12px}
.visit-label{font-size:.72rem;color:var(--muted);margin-bottom:3px}
.visit-num{font-size:1.08rem;font-weight:800;letter-spacing:-.02em}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.card{background:var(--card);border:1px solid var(--line2);border-radius:14px;overflow:hidden;transform:translateY(6px);opacity:0;animation:up .5s ease forwards;transition:box-shadow .2s,transform .2s}
.card:hover{box-shadow:0 6px 24px rgba(0,0,0,.06);transform:translateY(-2px)}
.card-link{display:block;text-decoration:none;color:inherit}
.card-body{padding:14px 16px 12px}
.card h3{margin:0 0 5px;font-size:.92rem;font-weight:700;letter-spacing:-.02em;color:var(--txt);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4}
.card .excerpt{margin:0 0 8px;color:var(--muted);font-size:.8rem;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .meta{font-size:.72rem;color:#a1a1a6;display:flex;align-items:center;gap:6px}
.card .meta .cat{color:var(--accent);font-weight:600}
.card .meta .dot{width:2px;height:2px;border-radius:50%;background:#a1a1a6}
.thumb{aspect-ratio:16/10;overflow:hidden;background:var(--bg2)}
.thumb img{display:block;width:100%;height:100%;object-fit:cover}
.thumb-empty{width:100%;height:100%;background:var(--bg2)}
.empty{padding:40px;text-align:center;color:var(--muted);background:var(--bg2);border-radius:14px;grid-column:1/-1;font-size:.9rem}
.write-btn{display:none;margin-bottom:20px}
.write-btn a{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:var(--txt);color:#fff;border-radius:999px;text-decoration:none;font-size:.84rem;font-weight:600;transition:opacity .15s}
.write-btn a:hover{opacity:.85}
.ad{margin:18px 0;padding:8px;border:1px dashed #e6e6ea;border-radius:12px;background:#fafafc}
@keyframes up{to{transform:translateY(0);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.menu-toggle{display:none;background:none;border:none;font-size:1.5rem;cursor:pointer;padding:4px 8px;color:var(--txt);line-height:1}
.mobile-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:99}
.mobile-overlay.open{display:block}
.mobile-menu{position:fixed;top:0;right:-300px;width:300px;height:100%;background:#fff;z-index:100;box-shadow:-4px 0 20px rgba(0,0,0,.1);padding:20px;overflow-y:auto;transition:right .25s ease}
.mobile-menu.open{right:0}
.mobile-menu .mm-close{background:none;border:none;font-size:1.3rem;cursor:pointer;float:right;padding:4px 8px;color:var(--txt)}
.mobile-menu .mm-section{margin-bottom:20px}
.mobile-menu .mm-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.mobile-menu .mm-cat{display:block;padding:8px 10px;font-size:.88rem;color:var(--txt);text-decoration:none;border-radius:8px;font-weight:500}
.mobile-menu .mm-cat:hover{background:var(--bg2)}
.mobile-menu .mm-search{display:flex;gap:6px;margin-bottom:16px}
.mobile-menu .mm-search input{flex:1;padding:8px 10px;border:1px solid var(--line2);border-radius:8px;font-size:.88rem;background:var(--bg2);outline:none}
.mobile-menu .mm-search button{padding:8px 14px;border:none;border-radius:8px;background:var(--txt);color:#fff;font-size:.84rem;font-weight:600;cursor:pointer}
@media(max-width:900px){.layout{grid-template-columns:1fr;gap:0}.sidebar{display:none}.grid{grid-template-columns:repeat(2,1fr)}.menu-toggle{display:block}}
@media(max-width:520px){.layout{padding:16px 16px 40px}.header-in{padding:11px 16px}.grid{grid-template-columns:1fr}.main-area h1{font-size:1.6rem}}
</style>
<meta name="google-adsense-account" content="ca-pub-3425189666333844">
${settings.adsense_code || ""}
</head>
<body>
<header class="header"><div class="header-in"><a href="/" class="brand">${escapeHtml(title)}</a><nav class="nav"><a href="/">홈</a><a href="/admin" class="pill">관리자</a><button class="menu-toggle" onclick="openMenu()">☰</button></nav></div></header>
<div style="background:#fff;border-bottom:1px solid #e8e8eb;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none"><div style="max-width:1280px;margin:0 auto;padding:0 20px;display:flex;align-items:stretch;white-space:nowrap"><div style="display:flex;align-items:center"><span style="font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px">카테고리</span>${cats.map(c=>`<a href="/?cat=${encodeURIComponent(c)}" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap${activeCat===c?';color:#0071e3;border-bottom-color:#0071e3;font-weight:700':''}">${escapeHtml(c)}</a>`).join('')}</div></div></div>
<div class="layout">
  <aside class="sidebar">
    <div class="profile">
      ${profileImage ? `<img class="profile-img" src="${escapeHtml(profileImage)}" alt="${escapeHtml(profileName)}" />` : `<div class="profile-initials">${escapeHtml(profileName.charAt(0))}</div>`}
      <div>
        <div class="profile-name">${escapeHtml(profileName)}</div>
        <div class="profile-desc">${escapeHtml(desc)}</div>
      </div>
    </div>
    <div class="side-section"><div class="side-search"><input type="text" id="sideSearch" placeholder="검색어를 입력하세요" value="${escapeHtml(searchQuery || '')}" onkeydown="if(event.key==='Enter'){var q=this.value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';}" /><button onclick="var q=document.getElementById('sideSearch').value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';">검색</button></div></div>
    ${cats.length ? `<div class="side-section"><div class="side-label">Categories</div>${catLinks}</div>` : ""}
    <section class="visit-strip">
      <div class="visit-card"><div class="visit-label">총 발행수</div><div class="visit-num">${Number(stats.published_posts || 0).toLocaleString()}</div></div>
      <div class="visit-card"><div class="visit-label">총 조회수</div><div class="visit-num">${Number(stats.total_views || 0).toLocaleString()}</div></div>
    </section>
  </aside>
  <main class="main-area">
    <div class="write-btn" data-admin><a href="/admin">+ 새 글 작성</a></div>
    ${searchQuery ? `<div class="filter-info">"${escapeHtml(searchQuery)}" 검색 결과 (${posts.length}건) <a href="/">전체보기</a></div>` : activeCat ? `<div class="filter-info">"${escapeHtml(activeCat)}" 카테고리 (${posts.length}건) <a href="/">전체보기</a></div>` : ""}
    ${adTop ? `<div class="ad">${adTop}</div>` : ""}
    <section class="grid" id="postGrid">${cards}</section>
    ${posts.length >= 12 ? '<div id="scrollSentinel" style="height:40px"></div><div id="scrollLoader" style="display:none;text-align:center;padding:24px"><svg width="28" height="28" viewBox="0 0 24 24" style="animation:spin .8s linear infinite"><circle cx="12" cy="12" r="10" fill="none" stroke="#ccc" stroke-width="2.5"/><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="#333" stroke-width="2.5" stroke-linecap="round"/></svg></div>' : ''}
    ${adBottom ? `<div class="ad">${adBottom}</div>` : ""}
  </main>
</div>
<div class="mobile-overlay" id="mobileOverlay" onclick="closeMenu()"></div>
<div class="mobile-menu" id="mobileMenu">
  <button class="mm-close" onclick="closeMenu()">✕</button>
  <div style="clear:both;margin-bottom:16px"></div>
  <div class="mm-search">
    <input type="text" id="mmSearch" placeholder="검색어를 입력하세요" onkeydown="if(event.key==='Enter'){var q=this.value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';}" />
    <button onclick="var q=document.getElementById('mmSearch').value.trim();if(q)location.href='/?q='+encodeURIComponent(q);else location.href='/';">검색</button>
  </div>
  ${cats.length ? `<div class="mm-section"><div class="mm-label">Categories</div>${cats.map(c => `<a href="/?cat=${encodeURIComponent(c)}" class="mm-cat">${escapeHtml(c)}</a>`).join("")}</div>` : ""}
</div>
<script>
(function(){
  if(localStorage.getItem('admin_token')){
    document.querySelectorAll('[data-admin]').forEach(function(el){el.style.display='flex'});
  }
})();
function openMenu(){document.getElementById('mobileMenu').classList.add('open');document.getElementById('mobileOverlay').classList.add('open')}
function closeMenu(){document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')}
(function(){
  var grid=document.getElementById('postGrid');
  var loader=document.getElementById('scrollLoader');
  var sentinel=document.getElementById('scrollSentinel');
  if(!grid||!sentinel)return;
  var page=2,loading=false,done=false;
  var cat=${JSON.stringify(activeCat||'')};
  var q=${JSON.stringify(searchQuery||'')};
  var isAdmin=!!localStorage.getItem('admin_token');
  function escHtml(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
  function stripH(s){var d=document.createElement('div');d.innerHTML=s;return(d.textContent||'').slice(0,80)}
  function utcToKSTDate(s){if(!s)return '';var u=String(s).trim().replace(' ','T');if(u.length<=19&&!u.endsWith('Z'))u+='Z';var d=new Date(u);if(!isFinite(d.getTime()))return String(s).slice(0,10);var k=new Date(d.getTime()+9*3600000);return k.toISOString().slice(0,10)}
  function makeCard(p){
    var excerpt=stripH(p.excerpt||'');
    var date=utcToKSTDate(p.publish_at||p.created_at||'');
    var thumb=p.thumbnail?'<img src="'+escHtml(p.thumbnail)+'" alt="'+escHtml(p.title)+'" loading="lazy" />':'<div class="thumb-empty"></div>';
    var adminHtml=isAdmin?'<div class="admin-tools" style="display:flex"><a href="/admin#edit-'+p.id+'">수정</a><button class="del" onclick="event.stopPropagation();if(!confirm(&apos;삭제?&apos;))return;fetch(&apos;/api/posts/'+p.id+'&apos;,{method:&apos;DELETE&apos;,headers:{&apos;Authorization&apos;:&apos;Bearer &apos;+localStorage.getItem(&apos;admin_token&apos;)}}).then(function(r){return r.json()}).then(function(d){if(d.success)location.reload();else alert(d.error||&apos;&apos;)}).catch(function(e){alert(e.message)})">삭제</button></div>':'';
    return '<article class="card" style="animation-delay:0s"><a href="/posts/'+escHtml(p.slug)+'" class="card-link"><div class="thumb">'+thumb+'</div><div class="card-body"><h3>'+escHtml(p.title)+'</h3><p class="excerpt">'+escHtml(excerpt)+'</p><div class="meta"><span class="cat">'+escHtml(p.category||'일반')+'</span><span class="dot"></span>'+escHtml(date)+'</div></div></a>'+adminHtml+'</article>';
  }
  function needsLoad(){
    var scrollBottom=window.innerHeight+window.pageYOffset;
    var docHeight=document.documentElement.offsetHeight;
    return scrollBottom>=docHeight-300;
  }
  function loadMore(){
    if(loading||done)return;
    loading=true;
    loader.style.display='block';
    page++;
    var apiUrl='/api/posts?page='+page+'&limit=6&status=published';
    if(cat)apiUrl+='&cat='+encodeURIComponent(cat);
    if(q)apiUrl+='&q='+encodeURIComponent(q);
    fetch(apiUrl).then(function(r){return r.json()}).then(function(data){
      loader.style.display='none';
      if(!data.posts||data.posts.length===0){done=true;sentinel.style.display='none';return}
      data.posts.forEach(function(p){grid.insertAdjacentHTML('beforeend',makeCard(p))});
      if(data.posts.length<6){done=true;sentinel.style.display='none'}
      loading=false;
    }).catch(function(){loader.style.display='none';loading=false});
  }
  window.addEventListener('scroll',function(){
    if(!done&&needsLoad())loadMore();
  });
  // 페이지 로드 시 스크롤 없이도 하단이면 즉시 로딩
  setTimeout(function(){if(!done&&needsLoad())loadMore()},300);
})();
</script>
</body>
</html>`;
}

/* ──── 🎨 [수정 가능] 글 상세 페이지 ──────────────────────────────────────────
   개별 블로그 글의 상세 페이지입니다. 본문 스타일, 레이아웃을 자유롭게 변경하세요.
   ⚠️ 함수명 renderPostPage(settings, post, relatedPosts) 유지 필수
   사용 가능한 데이터:
     settings: blog_name, blog_description, profile_name, theme_color, font_family, font_size_px,
               adsense_code, ad_top_html, ad_mid_html, ad_bottom_html, categories, ...
     post: id, title, slug, content, excerpt, category, thumbnail, status, views,
           publish_at, created_at, updated_at, meta_description, og_image, tags, word_count, reading_time
     relatedPosts[]: id, title, slug, excerpt, thumbnail, category, publish_at, created_at
   ────────────────────────────────────────────────────────────────────────────── */
function renderPostPage(settings, post, relatedPosts, origin) {
  relatedPosts = relatedPosts || [];
  const blogName = settings.blog_name || "Blog";
  const pageTitle = `${post.title} | ${blogName}`;
  const desc = stripHtml(post.excerpt || post.content || "").slice(0, 160);
  const metaDesc = post.meta_description || desc;
  const ogImage = post.og_image || post.thumbnail || "";
  const wordCount = post.word_count || stripHtml(post.content || "").length;
  const readingTime = post.reading_time || Math.ceil(wordCount / 500);
  const postTags = post.tags ? String(post.tags).split(",").map(t => t.trim()).filter(Boolean) : [];
  const siteOrigin = origin || "";
  const canonical = siteOrigin + `/posts/${post.slug}`;
  const theme = settings.theme_color || "#111111";
  const fontFamily = settings.font_family || "";
  const fontSize = Number(settings.font_size_px || 18);
  const profileName = settings.profile_name || "Admin";
  const profileImage = settings.profile_image || "";
  const cats = (settings.categories || "").split(",").map((c) => c.trim()).filter(Boolean);
  const catLinks = cats.map((c) => `<a href="/?cat=${encodeURIComponent(c)}" class="side-cat">${escapeHtml(c)}</a>`).join("");

  const adTop = settings.ad_top_html || "";
  const adMid = settings.ad_mid_html || "";
  const adBottom = settings.ad_bottom_html || "";

  const content = injectMidAd(post.content || "", adMid);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(metaDesc)}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeHtml(post.title)}" />
<meta property="og:description" content="${escapeHtml(metaDesc)}" />
<meta property="og:image" content="${escapeHtml(ogImage)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="article:published_time" content="${escapeHtml(post.created_at || "")}" />
<meta property="article:section" content="${escapeHtml(post.category || "")}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(post.title)}" />
<meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
<meta name="twitter:image" content="${escapeHtml(ogImage)}" />
<meta name="twitter:image:alt" content="${escapeHtml(post.title)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"BlogPosting","headline":post.title,"description":metaDesc,"image":ogImage,"datePublished":post.created_at||"","dateModified":post.updated_at||post.created_at||"","wordCount":wordCount,"inLanguage":"ko","keywords":postTags.join(", "),"author":{"@type":"Person","name":settings.profile_name||"Admin"},"publisher":{"@type":"Organization","name":blogName},"mainEntityOfPage":{"@type":"WebPage","@id":canonical}})}</script>
<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":siteOrigin+"/"},{"@type":"ListItem","position":2,"name":post.category||"Posts","item":post.category?siteOrigin+"/?cat="+encodeURIComponent(post.category):siteOrigin+"/"},{"@type":"ListItem","position":3,"name":post.title,"item":canonical}]})}</script>
${(() => { const faqMatches = [...(post.content || "").matchAll(/<h3 class="faq-q">([\s\S]*?)<\/h3>\s*<div class="faq-a">([\s\S]*?)<\/div>/gi)]; return faqMatches.length ? `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":faqMatches.map(m => ({"@type":"Question","name":stripHtml(m[1]),"acceptedAnswer":{"@type":"Answer","text":stripHtml(m[2])}}))})}</script>` : ""; })()}
<style>
:root{--theme:${escapeHtml(theme)};--line:#ececf0;--line2:#e8e8eb;--muted:#74747d;--txt:#16161a;--bg2:#f5f5f7}
html{scroll-behavior:smooth}*{box-sizing:border-box} body{margin:0;background:#fff;color:var(--txt);font-family:${fontFamily ? escapeHtml(fontFamily) + ',' : ''}-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);border-bottom:.5px solid rgba(0,0,0,.08)}
.header-in{max-width:1200px;margin:0 auto;padding:13px 28px;display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;font-size:1.15rem;text-decoration:none;color:var(--txt)}
.nav{display:flex;gap:20px;align-items:center}
.nav a{color:var(--muted);text-decoration:none;font-size:.84rem;font-weight:500}
.nav .pill{padding:6px 14px;border-radius:999px;background:#111;color:#fff}
.layout{max-width:1200px;margin:0 auto;padding:32px 28px 60px;display:grid;grid-template-columns:220px 1fr;gap:40px}
.sidebar{position:sticky;top:80px;align-self:start}
.profile{text-align:center;margin-bottom:28px}
.profile-img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid var(--line2)}
.profile-initials{width:72px;height:72px;border-radius:50%;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;margin:0 auto}
.profile-name{margin:10px 0 2px;font-size:.95rem;font-weight:700}
.profile-desc{font-size:.78rem;color:var(--muted)}
.side-section{margin-bottom:20px}
.side-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.side-cat,.side-link{display:block;padding:6px 10px;font-size:.84rem;color:var(--txt);text-decoration:none;border-radius:8px}
.side-cat:hover,.side-link:hover{background:var(--bg2)}
.main{min-width:0}
.wrap{max-width:860px;padding:0 0 48px}
a{color:#2563eb;text-decoration:none}
.top{display:flex;justify-content:space-between;align-items:center;font-size:.9rem;color:#555;margin-bottom:18px}
h1{margin:0 0 14px;font-size:clamp(1.8rem,4vw,2.9rem);line-height:1.18;letter-spacing:-.03em}
.meta{color:var(--muted);font-size:.92rem;margin:0 0 20px}
.content{font-size:${Math.max(15, Math.min(24, fontSize))}px;line-height:1.86;word-break:break-word}
.content h2,.content h3{line-height:1.35;letter-spacing:-.02em}
.content img{max-width:100%;height:auto;border-radius:12px;margin:14px 0}
.content table{border-radius:0!important;overflow:visible}.content table *{border-radius:0!important}
.content a{word-break:break-all}
.video-wrap{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#000;margin:14px 0}
.video-wrap iframe{position:absolute;top:0;left:0;width:100%;height:100%}
.ad{margin:18px 0;padding:8px;border:1px dashed #e6e6ea;border-radius:12px;background:#fafafc}
hr{border:none;border-top:1px solid var(--line);margin:30px 0}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin:24px 0 0}
.act-btn{display:inline-flex;align-items:center;gap:4px;padding:8px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:#555;font-size:.84rem;font-weight:600;cursor:pointer;text-decoration:none;font-family:inherit}
.act-btn:hover{background:#111;color:#fff;border-color:#111}
.act-btn.del{color:#e53e3e;border-color:#fed7d7}
.act-btn.del:hover{background:#e53e3e;color:#fff;border-color:#e53e3e}
.act-btn.copied{background:#22c55e;color:#fff;border-color:#22c55e}
.admin-only{display:none}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}
.tag{display:inline-block;padding:4px 10px;border-radius:999px;background:var(--bg2);font-size:.78rem;color:var(--muted);font-weight:500}
.related{margin:24px 0 0;padding:20px 0 0;border-top:1px solid var(--line)}
.related h3{font-size:1rem;font-weight:700;margin:0 0 14px}
.related-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0;margin:0}
.related-card{border:1px solid var(--line2);border-radius:12px;overflow:hidden;transition:box-shadow .2s,transform .2s}
.related-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.06);transform:translateY(-2px)}
.related-card a{text-decoration:none;color:inherit;display:block}
.related-thumb{aspect-ratio:16/10;overflow:hidden;background:var(--bg2)}
.related-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.related-body{padding:10px 12px}
.related-body .r-title{font-size:.86rem;font-weight:700;color:var(--txt);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;margin:0 0 4px}
.related-body .r-excerpt{font-size:.76rem;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;margin:0 0 6px}
.related-body .r-meta{font-size:.7rem;color:#a1a1a6}
.content h2{position:relative}
.content h2 .heading-anchor{display:none;position:absolute;left:-1.2em;color:var(--muted);text-decoration:none;font-weight:400}
.content h2:hover .heading-anchor{display:inline}
.menu-toggle{display:none;background:none;border:none;font-size:1.5rem;cursor:pointer;padding:4px 8px;color:var(--txt);line-height:1}
.mobile-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.3);z-index:99}
.mobile-overlay.open{display:block}
.mobile-menu{position:fixed;top:0;right:-300px;width:300px;height:100%;background:#fff;z-index:100;box-shadow:-4px 0 20px rgba(0,0,0,.1);padding:20px;overflow-y:auto;transition:right .25s ease}
.mobile-menu.open{right:0}
.mobile-menu .mm-close{background:none;border:none;font-size:1.3rem;cursor:pointer;float:right;padding:4px 8px;color:var(--txt)}
.mobile-menu .mm-section{margin-bottom:20px}
.mobile-menu .mm-label{font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
.mobile-menu .mm-cat{display:block;padding:8px 10px;font-size:.88rem;color:var(--txt);text-decoration:none;border-radius:8px;font-weight:500}
.mobile-menu .mm-cat:hover{background:var(--bg2)}
@media(max-width:900px){.layout{grid-template-columns:1fr;gap:0}.sidebar{display:none}.menu-toggle{display:block}.related-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:520px){.related-grid{grid-template-columns:1fr}}
</style>
<meta name="google-adsense-account" content="ca-pub-3425189666333844">
${settings.adsense_code || ""}

</head>
<body>
<header class="header"><div class="header-in"><a href="/" class="brand">${escapeHtml(blogName)}</a><nav class="nav"><a href="/">홈</a><a href="/admin" class="pill">관리자</a><button class="menu-toggle" onclick="openMenu()">☰</button></nav></div></header>
<div style="background:#fff;border-bottom:1px solid #e8e8eb;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none"><div style="max-width:1280px;margin:0 auto;padding:0 20px;display:flex;align-items:stretch;white-space:nowrap"><div style="display:flex;align-items:center"><span style="font-size:.68rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.06em;padding:0 10px 0 4px">카테고리</span>${(settings.categories||"").split(",").map(c=>c.trim()).filter(Boolean).map(c=>`<a href="/?cat=${encodeURIComponent(c)}" style="display:inline-flex;align-items:center;padding:9px 12px;font-size:.8rem;color:#86868b;text-decoration:none;font-weight:500;border-bottom:2px solid transparent;white-space:nowrap">${escapeHtml(c)}</a>`).join('')}</div></div></div>
<div class="layout">
  <aside class="sidebar">
    <div class="profile">
      ${profileImage ? `<img class="profile-img" src="${escapeHtml(profileImage)}" alt="${escapeHtml(profileName)}" />` : `<div class="profile-initials">${escapeHtml(profileName.charAt(0))}</div>`}
      <div>
        <div class="profile-name">${escapeHtml(profileName)}</div>
        <div class="profile-desc">${escapeHtml(settings.blog_description || "")}</div>
      </div>
    </div>
    ${cats.length ? `<div class="side-section"><div class="side-label">Categories</div>${catLinks}</div>` : ""}
  </aside>
  <main class="main">
    <div class="wrap">
      <div class="top"><a href="/">← 목록으로</a></div>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="meta">${escapeHtml(post.category || "일반")} · ${escapeHtml(formatKSTDate(post.publish_at || post.created_at))} · 약 ${readingTime}분 · 조회 ${Number(post.views || 0)}</div>
      <div class="actions admin-only" id="topActions">
        <button class="act-btn" onclick="copyLink()">링크 복사</button>
        <a class="act-btn" href="/admin#edit-${post.id}">수정</a>
        <button class="act-btn del" onclick="deletePost(${post.id})">삭제</button>
      </div>
      ${adTop ? `<div class="ad">${adTop}</div>` : ""}
      <article class="content">${content}</article>
${postTags.length ? `<div class="tags">${postTags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
${relatedPosts.length ? `<div class="related"><h3>관련 글</h3><div class="related-grid">${relatedPosts.map(p => `<div class="related-card"><a href="/posts/${escapeHtml(p.slug)}"><div class="related-thumb">${p.thumbnail ? `<img src="${escapeHtml(p.thumbnail)}" alt="${escapeHtml(p.title)}" width="370" height="231" loading="lazy" />` : `<div style="width:100%;height:100%"></div>`}</div><div class="related-body"><div class="r-title">${escapeHtml(p.title)}</div><div class="r-excerpt">${escapeHtml(stripHtml(p.excerpt || '').slice(0, 80))}</div><div class="r-meta">${escapeHtml(p.category || '')} · ${escapeHtml(formatKSTDate(p.publish_at || p.created_at))}</div></div></a></div>`).join("")}</div></div>` : ""}
      ${adBottom ? `<div class="ad">${adBottom}</div>` : ""}
      <hr />
      <div class="actions">
        <button class="act-btn" onclick="copyLink()">링크 복사</button>
        <a class="act-btn admin-only" href="/admin#edit-${post.id}">수정</a>
        <button class="act-btn del admin-only" onclick="deletePost(${post.id})">삭제</button>
      </div>
    </div>
  </main>
 </div>
<div class="mobile-overlay" id="mobileOverlay" onclick="closeMenu()"></div>
<div class="mobile-menu" id="mobileMenu">
  <button class="mm-close" onclick="closeMenu()">✕</button>
  <div style="clear:both;margin-bottom:16px"></div>
  ${cats.length ? `<div class="mm-section"><div class="mm-label">Categories</div>${cats.map(c => `<a href="/?cat=${encodeURIComponent(c)}" class="mm-cat">${escapeHtml(c)}</a>`).join("")}</div>` : ""}
</div>
<script>
function copyLink(){var b=document.querySelector('.act-btn');navigator.clipboard.writeText(location.href).then(function(){b.textContent='복사됨!';b.classList.add('copied');setTimeout(function(){b.textContent='링크 복사';b.classList.remove('copied')},1500)})}
async function deletePost(id){if(!confirm('이 글을 삭제하시겠습니까?'))return;var t=localStorage.getItem('admin_token');if(!t){alert('로그인이 필요합니다.');return}try{var r=await fetch('/api/posts/'+id,{method:'DELETE',headers:{'Authorization':'Bearer '+t}});var d=await r.json();if(d.success){window.location.href='/'}else{alert('삭제 실패: '+(d.error||''))}}catch(e){alert('삭제 오류: '+e.message)}}
if(localStorage.getItem('admin_token')){document.querySelectorAll('.admin-only').forEach(function(el){el.style.display=el.tagName==='DIV'?'flex':'inline-flex'})}
(function(){var hs=document.querySelectorAll('.content h2');hs.forEach(function(h,i){if(!h.id){var id='h-'+i+'-'+h.textContent.trim().replace(/\\s+/g,'-').replace(/[^a-zA-Z0-9가-힣-]/g,'').slice(0,40);h.setAttribute('id',id)}var a=document.createElement('a');a.className='heading-anchor';a.href='#'+h.id;a.textContent='#';h.insertBefore(a,h.firstChild)})})();
function openMenu(){document.getElementById('mobileMenu').classList.add('open');document.getElementById('mobileOverlay').classList.add('open')}
function closeMenu(){document.getElementById('mobileMenu').classList.remove('open');document.getElementById('mobileOverlay').classList.remove('open')}
(function(){var k='viewed_${post.id}',u='/api/posts/${post.id}/view',isAdmin=!!localStorage.getItem('admin_token'),opt=(!sessionStorage.getItem(k)&&!isAdmin)?{method:'POST'}:{};if(!sessionStorage.getItem(k)&&!isAdmin){sessionStorage.setItem(k,'1')}fetch(u,opt).then(function(r){return r.json()}).then(function(d){if(d.views!=null){var m=document.querySelector('.meta');if(m){m.textContent=m.textContent.replace(/조회 \\d+/,'조회 '+d.views)}}}).catch(function(){})})();
</script>
</body>
</html>`;
}

/* ──── 🎨 [수정 가능] 본문 중간 광고 삽입 ──────────────────────────────────────
   본문 중간에 광고를 삽입하는 위치/방식을 변경할 수 있습니다.
   ⚠️ 함수명 injectMidAd(content, adHtml) 유지 필수
   ⚠️ 반드시 HTML 문자열을 return 해야 합니다
   ────────────────────────────────────────────────────────────────────────────── */
function injectMidAd(content, adHtml) {
  if (!adHtml) return content;
  const adBlock = `<div class="ad">${adHtml}</div>`;
  const parts = String(content).split(/<\/p>/i);
  if (parts.length < 2) return content + adBlock;
  const mid = Math.floor(parts.length / 2);
  parts[mid] = parts[mid] + `</p>` + adBlock;
  return parts.join("</p>");
}

/* ──── 🎨 [수정 가능] HTML 내보내기 템플릿 ──────────────────────────────────────
   글을 HTML 파일로 내보낼 때 사용되는 템플릿입니다.
   ⚠️ 함수명 renderExportHtml(settings, post) 유지 필수
   ────────────────────────────────────────────────────────────────────────────── */
function renderExportHtml(settings, post) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(post.title)}</title><meta name="description" content="${escapeHtml(post.excerpt || '')}"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:860px;margin:40px auto;padding:0 16px;line-height:1.8;color:#111}img{max-width:100%;height:auto;border-radius:10px}</style>${settings.adsense_code || ''}</head><body><h1>${escapeHtml(post.title)}</h1><div>${escapeHtml(formatKSTDate(post.created_at))}</div><hr><article>${post.content || ''}</article></body></html>`;
}

/* ──── 🎨 [수정 가능] 관리자 대시보드 ──────────────────────────────────────────
   관리자 페이지의 HTML, CSS, 에디터 UI를 자유롭게 변경하세요.
   ⚠️ 함수명 renderAdminPage() 유지 필수
   ⚠️ API 호출 경로(/api/...)와 인증 로직(token, authJson 등)은 변경 불가
   ⚠️ 에디터 핵심 함수명(savePost, loadPosts, editPost 등)은 변경 불가
   수정 가능한 부분:
     - CSS 스타일 (색상, 폰트, 레이아웃, 간격 등)
     - HTML 구조 (카드 배치, 버튼 위치 등)
     - 탭 이름/순서 (tabList 배열)
     - 통계 표시 형태 (loadStats 내 HTML)
     - 에디터 툴바 버튼 배치
   ────────────────────────────────────────────────────────────────────────────── */
function renderAdminPage() {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>blog-platform Admin</title>
<style>
:root{--bg:#f5f5f7;--card:#fff;--txt:#17171c;--line:#e8e8ed;--muted:#7c7c86;--pri:#111}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--txt)}
.wrap{max-width:1120px;margin:0 auto;padding:18px}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.brand{font-size:1.45rem;font-weight:800;letter-spacing:-.03em}
.btn{background:#111;color:#fff;border:none;border-radius:10px;padding:10px 14px;cursor:pointer;font-weight:700;font-size:.88rem}
.btn.light{background:#fff;color:#111;border:1px solid var(--line)}
.btn:hover{opacity:.85}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}
.card h3{margin:0 0 10px;font-size:1rem}
.row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
input,textarea,select{width:100%;border:1px solid var(--line);background:#fff;color:#111;border-radius:10px;padding:10px;font:inherit}
textarea{min-height:120px;resize:vertical}
label{font-size:.82rem;color:var(--muted);display:block;margin:8px 0 6px}
.small{font-size:.8rem;color:var(--muted)}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.tab{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;cursor:pointer;font-size:.88rem;font-weight:600}
.tab.active{background:#111;color:#fff;border-color:#111}
.hidden{display:none}
.list{max-height:600px;overflow:auto;border:1px solid var(--line);border-radius:12px}
.item{padding:10px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px;align-items:center}
.item:last-child{border-bottom:none}
.item .title{font-weight:700;font-size:.95rem}
.item .meta{font-size:.76rem;color:var(--muted);margin-top:3px}
.tools{display:flex;gap:6px;flex-wrap:wrap}
.out{white-space:pre-wrap;background:#0b1020;color:#d8deff;padding:10px;border-radius:12px;min-height:70px;font-size:.82rem}
/* Editor styles */
.editor-card{padding:0;overflow:visible;position:relative}
.editor-top-sticky{position:sticky;top:0;z-index:60;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 6px 14px rgba(0,0,0,.04)}
.title-input{width:100%;border:none;border-bottom:2px solid var(--line);border-radius:0;padding:20px 20px 14px;font-size:1.8rem;font-weight:800;letter-spacing:-.03em;outline:none;background:transparent}
.title-input:focus{border-bottom-color:#111}
.title-input::placeholder{color:#c0c0c4}
.meta-row{display:grid;grid-template-columns:1fr 1fr 1fr 1.2fr;gap:8px;padding:10px 20px}
.meta-row input,.meta-row select{border-radius:8px;padding:8px 10px;font-size:.88rem}
.meta-row label{margin:0 0 4px;font-size:.78rem}
.toolbar{display:flex;flex-wrap:wrap;gap:3px;padding:8px 16px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:#fafafa}
.tb{background:#fff;border:1px solid #e0e0e3;border-radius:7px;padding:5px 9px;cursor:pointer;font-size:.82rem;font-weight:600;color:#444;line-height:1}
.tb:hover{background:#eee}
.tb.on{background:#111;color:#fff;border-color:#111}
.tb-sep{width:1px;background:#ddd;margin:2px 5px;align-self:stretch}
.tb-select{height:30px;border:1px solid #e0e0e3;border-radius:7px;background:#fff;padding:0 8px;font-size:.78rem;color:#444}
.tb-color{width:34px;height:30px;border:1px solid #e0e0e3;border-radius:7px;padding:2px;background:#fff;cursor:pointer}
.editor-area{min-height:500px;padding:24px 24px 80px;background:#fff;font-size:17px;line-height:1.85;color:#111;outline:none;overflow-y:auto;word-break:break-word}
.editor-area:empty::before{content:attr(data-ph);color:#bbb;pointer-events:none}
.editor-area img{max-width:100%;height:auto;border-radius:10px;margin:12px 0;display:block}
.editor-area blockquote{border-left:3px solid #ddd;margin:12px 0;padding:8px 16px;color:#555;background:#fafafa;border-radius:0 8px 8px 0}
.editor-area h2{font-size:1.5rem;margin:24px 0 8px;letter-spacing:-.02em}
.editor-area h3{font-size:1.25rem;margin:20px 0 6px;letter-spacing:-.01em}
.editor-area a{color:#2563eb}
.editor-area hr{border:none;border-top:1px solid #e0e0e3;margin:24px 0}
.source-area{display:none;min-height:500px;padding:16px;font-family:monospace;font-size:13px;line-height:1.6;border:none;border-radius:0;resize:vertical;background:#fafcff}
.drag-over{outline:3px dashed #2563eb;outline-offset:-6px;background:#f0f4ff}
.img-uploading{padding:16px;background:#f5f5f7;border-radius:10px;color:#999;text-align:center;margin:12px 0;font-size:.9rem}
.status-bar{display:flex;justify-content:space-between;padding:8px 20px;font-size:.78rem;color:var(--muted);border-top:1px solid var(--line);background:#fafafa}
.action-bar{display:flex;gap:8px;padding:12px 20px;flex-wrap:wrap;position:sticky;bottom:0;z-index:55;background:#fff;border-top:1px solid var(--line);box-shadow:0 -6px 14px rgba(0,0,0,.04)}
.schedule-help{font-size:.72rem;color:#888;margin-top:4px}
.img-size-popup{position:absolute;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);padding:6px;display:flex;gap:4px;z-index:20}
.img-size-popup button{background:#f5f5f7;border:1px solid #e0e0e3;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:.78rem;font-weight:600}
.img-size-popup button:hover{background:#111;color:#fff}
.img-popup-sep{width:1px;background:#ddd;margin:0 3px;align-self:stretch}
.img-thumb-btn{background:#eef4ff!important;border-color:#b3d1ff!important;color:#0071e3!important;font-size:.75rem!important}
.img-thumb-btn:hover{background:#0071e3!important;color:#fff!important}
.editor-area img.img-selected{outline:3px solid #2563eb;outline-offset:2px;cursor:pointer}
.thumb-row{display:flex;gap:8px;align-items:flex-end}
.thumb-row input{flex:1}
.thumb-preview{width:80px;height:56px;border-radius:8px;object-fit:cover;border:1px solid var(--line);display:none}
.thumb-preview.show{display:block}
.seo-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:100;display:flex;align-items:center;justify-content:center}
.seo-popup{background:#fff;border-radius:18px;width:90%;max-width:560px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.18)}
.seo-popup-header{padding:18px 22px 12px;border-bottom:1px solid var(--line);font-size:1.1rem;font-weight:800;display:flex;justify-content:space-between;align-items:center}
.seo-popup-body{padding:16px 22px}
.seo-popup-body pre{background:#f5f5f7;padding:12px;border-radius:10px;font-size:.82rem;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow-y:auto}
.seo-popup-footer{padding:12px 22px 18px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--line)}
.seo-score{font-size:2rem;font-weight:900;margin:8px 0}
.seo-score.good{color:#22c55e}.seo-score.mid{color:#eab308}.seo-score.bad{color:#e53e3e}
.seo-list{margin:8px 0;padding-left:18px;font-size:.88rem;line-height:1.7;color:#555}
/* Category management popup */
.cat-wrap{display:flex;gap:6px;align-items:flex-end}
.cat-wrap select{flex:1}
.cat-mgr-btn{background:#f5f5f7;border:1px solid #e0e0e3;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:.78rem;font-weight:700;white-space:nowrap}
.cat-mgr-btn:hover{background:#111;color:#fff}
.cat-popup-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.35);z-index:100;display:flex;align-items:center;justify-content:center}
.cat-popup{background:#fff;border-radius:16px;width:90%;max-width:420px;box-shadow:0 16px 48px rgba(0,0,0,.16)}
.cat-popup-header{padding:16px 20px 12px;border-bottom:1px solid var(--line);font-size:1rem;font-weight:800;display:flex;justify-content:space-between;align-items:center}
.cat-popup-body{padding:16px 20px;max-height:320px;overflow-y:auto}
.cat-item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f2}
.cat-item:last-child{border-bottom:none}
.cat-item input{flex:1;border:1px solid #e0e0e3;border-radius:8px;padding:6px 10px;font-size:.88rem}
.cat-item-btns{display:flex;gap:4px}
.cat-item-btns button{border:none;background:#f5f5f7;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:.76rem;font-weight:700}
.cat-item-btns button.del{color:#e53e3e}
.cat-item-btns button.del:hover{background:#e53e3e;color:#fff}
.cat-item-btns button.save{color:#2563eb}
.cat-item-btns button.save:hover{background:#2563eb;color:#fff}
.cat-popup-footer{padding:10px 20px 16px;display:flex;gap:8px;justify-content:space-between;border-top:1px solid var(--line)}
.cat-add-row{display:flex;gap:8px}
.cat-add-row input{flex:1;border:1px solid #e0e0e3;border-radius:8px;padding:6px 10px;font-size:.88rem}
@media(max-width:700px){.meta-row{grid-template-columns:1fr}.title-input{font-size:1.4rem;padding:14px 14px 10px}.toolbar{padding:6px 10px}.editor-area{padding:16px 14px 60px;font-size:15px}.action-bar{padding:10px 14px}.row{grid-template-columns:1fr}.editor-top-sticky{top:0}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div class="brand">blog-platform \uad00\ub9ac\uc790</div><div class="tools"><a href="/" class="btn light" style="text-decoration:none;display:inline-flex;align-items:center">블로그 보기</a><button class="btn light" onclick="logout()">로그아웃</button></div></div>

  <div class="card" id="loginCard">
    <h3>관리자 로그인</h3>
    <div class="row"><input id="pw" type="password" placeholder="비밀번호" onkeydown="if(event.key==='Enter')login()"><button id="loginBtn" class="btn" onclick="login()">로그인</button></div>
    <div class="small">첫 비밀번호는 워커 env ` + "`ADMIN_PASSWORD`" + ` 또는 ` + "`ADMIN_PASSWORD_HASH`" + ` 기준.</div>
  </div>

  <div id="adminApp" class="hidden">
    <div class="tabs" id="tabs"></div>

    <!-- 글쓰기 -->
    <div id="panel-editor">
      <div class="card editor-card">
        <div class="editor-top-sticky">
        <input id="title" class="title-input" placeholder="제목을 입력하세요">
        <div class="meta-row">
          <div><label>카테고리</label><div class="cat-wrap"><select id="category"><option value="">선택</option></select><button type="button" class="cat-mgr-btn" onclick="openCatPopup()">관리</button></div></div>
    <!-- 카테고리 관리 팝업 -->
    <div id="catOverlay" class="cat-popup-overlay" style="display:none" onclick="if(event.target===this)closeCatPopup()">
      <div class="cat-popup">
        <div class="cat-popup-header"><span>카테고리 관리</span><button onclick="closeCatPopup()" style="border:none;background:none;font-size:1.2rem;cursor:pointer">&times;</button></div>
        <div class="cat-popup-body" id="catList"></div>
        <div class="cat-popup-footer">
          <div class="cat-add-row"><input id="catNewInput" placeholder="새 카테고리 이름" onkeydown="if(event.key==='Enter')addCategory()"><button class="btn" onclick="addCategory()" style="padding:6px 14px;font-size:.82rem">추가</button></div>
        </div>
      </div>
    </div>
          <div><label>상태</label><select id="status" onchange="onStatusChange()"><option value="published">발행</option><option value="draft">임시저장</option><option value="scheduled">예약발행</option></select></div>
          <div><label>썸네일</label><div class="thumb-row"><input id="thumbnail" placeholder="URL 직접 입력 또는 업로드"><img id="thumbPreview" class="thumb-preview"><button type="button" class="btn light" onclick="pickThumbnail()" style="padding:6px 10px;font-size:.78rem;white-space:nowrap">업로드</button></div></div>
          <div id="publishAtWrap"><label>예약 시간</label><input id="publish_at" type="datetime-local"><div class="schedule-help">현재 기준 +50일 이내</div></div>
        </div>
        <div class="toolbar" id="toolbar">
          <button class="tb" id="tb-bold" onmousedown="event.preventDefault();fmt('bold')" title="굵게"><b>B</b></button>
          <button class="tb" id="tb-italic" onmousedown="event.preventDefault();fmt('italic')" title="기울임"><i>I</i></button>
          <button class="tb" id="tb-underline" onmousedown="event.preventDefault();fmt('underline')" title="밑줄"><u>U</u></button>
          <button class="tb" id="tb-strikethrough" onmousedown="event.preventDefault();fmt('strikethrough')" title="취소선"><s>S</s></button>
          <div class="tb-sep"></div>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'H2')" title="소제목">H2</button>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'H3')" title="소소제목">H3</button>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'P')" title="본문">P</button>
          <div class="tb-sep"></div>
          <button class="tb" id="tb-insertUnorderedList" onmousedown="event.preventDefault();fmt('insertUnorderedList')" title="점 목록">• 목록</button>
          <button class="tb" id="tb-insertOrderedList" onmousedown="event.preventDefault();fmt('insertOrderedList')" title="번호 목록">1. 목록</button>
          <button class="tb" onmousedown="event.preventDefault();fmt('formatBlock',false,'BLOCKQUOTE')" title="인용">인용</button>
          <div class="tb-sep"></div>
          <button class="tb" id="tb-justifyLeft" onmousedown="event.preventDefault();fmt('justifyLeft')" title="왼쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="2.5" x2="13" y2="2.5"/><line x1="1" y1="5.5" x2="9" y2="5.5"/><line x1="1" y1="8.5" x2="13" y2="8.5"/><line x1="1" y1="11.5" x2="9" y2="11.5"/></svg>
          </button>
          <button class="tb" id="tb-justifyCenter" onmousedown="event.preventDefault();fmt('justifyCenter')" title="가운데 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="2.5" x2="13" y2="2.5"/><line x1="3" y1="5.5" x2="11" y2="5.5"/><line x1="1" y1="8.5" x2="13" y2="8.5"/><line x1="3" y1="11.5" x2="11" y2="11.5"/></svg>
          </button>
          <button class="tb" id="tb-justifyRight" onmousedown="event.preventDefault();fmt('justifyRight')" title="오른쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="2.5" x2="13" y2="2.5"/><line x1="5" y1="5.5" x2="13" y2="5.5"/><line x1="1" y1="8.5" x2="13" y2="8.5"/><line x1="5" y1="11.5" x2="13" y2="11.5"/></svg>
          </button>
          <div class="tb-sep"></div>
          <button class="tb" onmousedown="event.preventDefault();fmt('insertHorizontalRule')" title="구분선">─</button>
          <button class="tb" onmousedown="event.preventDefault();insertLink()" title="링크">링크</button>
          <button class="tb" onmousedown="event.preventDefault();openImagePicker()" title="이미지 업로드">이미지 ↑</button>
          <div class="tb-sep"></div>
          <select id="fontSizePx" class="tb-select" onchange="applyFontSizePx(this.value)" title="글자 크기(px)">
            <option value="">크기(px)</option>
            <option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option><option value="13">13</option><option value="14">14</option><option value="15">15</option><option value="16">16</option><option value="18">18</option><option value="20">20</option><option value="24">24</option><option value="28">28</option><option value="32">32</option>
          </select>
          <input id="fontColorPick" class="tb-color" type="color" value="#111111" onchange="applyTextColor(this.value)" title="글자 색상">
          <button class="tb" onmousedown="event.preventDefault();clearInlineStyle()" title="글자 스타일 제거">스타일해제</button>
        </div>
        </div>
        <div id="editorArea" contenteditable="true" class="editor-area" data-ph="내용을 입력하세요..."></div>
        <textarea id="sourceArea" class="source-area" placeholder="HTML 소스를 직접 편집할 수 있습니다"></textarea>
        <div class="status-bar"><span id="charCount">0자</span><span id="autoSaveStatus">-</span></div>
        <div class="action-bar">
          <button id="saveBtn" type="button" class="btn" onclick="savePost()">저장/발행</button>
          <button class="btn light" onclick="saveDraft()">임시저장</button>
          <button class="btn light" onclick="newPost()">새 글</button>
          <button class="btn light" onclick="toggleSource()">HTML 보기</button>

          <button class="btn light" onclick="exportHtml()">내보내기</button>
          <input id="seoKeyword" placeholder="SEO 키워드" style="width:140px;padding:8px 10px;border-radius:10px;border:1px solid #e8e8ed;font-size:.85rem">
          <button class="btn light" onclick="seoAnalyzeFromEditor()">SEO 분석</button>
        </div>
      </div>
    </div>

    <!-- 글 관리 -->
    <div id="panel-manage" style="display:none">
      <div class="card">
        <h3>글 관리</h3>
        <div class="tools" style="margin-bottom:8px"><button class="btn light" onclick="loadPosts('published')">발행됨</button><button class="btn light" onclick="loadPosts('scheduled')">예약됨</button><button class="btn light" onclick="loadPosts('draft')">임시저장</button></div>
        <div class="list" id="postList"></div>
      </div>
    </div>

    <!-- 설정 -->
    <div id="panel-settings" style="display:none">
      <div class="card">
        <h3>블로그 설정</h3>
        <div class="row">
          <div><label>블로그 이름</label><input id="s_blog_name"></div>
          <div><label>블로그 설명</label><input id="s_blog_description"></div>
        </div>
        <div class="row">
          <div><label>프로필 이름</label><input id="s_profile_name"></div>
          <div><label>테마 색상</label><input id="s_theme_color" placeholder="#111111"></div>
        </div>
        <label>프로필 이미지</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="s_profile_image" placeholder="URL 직접 입력 또는 업로드">
          <img id="profileImgPreview" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:1px solid #e8e8ed;display:none">
          <button type="button" class="btn light" onclick="pickProfileImage()" style="padding:6px 12px;font-size:.78rem;white-space:nowrap">업로드</button>
        </div>
        <div class="row">
          <div><label>폰트명</label><input id="s_font_family" placeholder="Pretendard Variable"></div>
          <div><label>본문 글자크기(px)</label><input id="s_font_size_px" placeholder="18"></div>
        </div>
        <label>카테고리 목록 (쉼표 구분)</label><input id="s_categories" placeholder="일반,기술,일상,리뷰">
        <label>애드센스 코드(head/body 공용)</label><textarea id="s_adsense_code"></textarea>
        <label>상단 광고 HTML</label><textarea id="s_ad_top_html"></textarea>
        <label>중간 광고 HTML</label><textarea id="s_ad_mid_html"></textarea>
        <label>하단 광고 HTML</label><textarea id="s_ad_bottom_html"></textarea>
        <div class="row">
          <div><label>Google verification</label><input id="s_google_verification"></div>
          <div><label>Naver verification</label><input id="s_naver_verification"></div>
        </div>
        <div class="row">
          <div><label>네이버 API ID</label><input id="s_naver_client_id"></div>
          <div><label>네이버 API SECRET</label><input id="s_naver_client_secret"></div>
        </div>
        <label>IndexNow Key (글 발행 시 Bing/Yandex 자동 인덱싱)</label><input id="s_indexnow_key" placeholder="자동 생성됨">
        <div class="row">
          <div><label>자동화 API Key</label><input id="s_api_key"></div>
          <div><label>TurtleBuff API Key</label><input id="s_turtlebuff_api_key"></div>
        </div>
        <label>관리자 비밀번호 변경(6자+)</label><input id="s_admin_password" type="password" placeholder="변경 시 입력">
        <div class="tools" style="margin-top:8px"><button class="btn" onclick="saveSettings()">설정 저장</button></div>
      </div>
    </div>

    <!-- SEO -->
    <div id="panel-seo" style="display:none">
      <div class="card">
        <h3>SEO 분석/최적화</h3>
        <label>키워드</label><input id="seo_keyword" placeholder="예: 스마트스토어 마케팅">
        <div class="tools" style="margin-top:8px">
          <button class="btn light" onclick="analyzeSeo()">분석</button>
          <button class="btn" onclick="optimizeCurrent()">현재 글 자동 최적화</button>
        </div>
        <div class="small" style="margin-top:8px">네이버 API를 넣어두면 검색량 참고 결과도 같이 표시됨.</div>
        <div class="out" id="seoOut" style="margin-top:10px">ready</div>
        <hr style="border:none;border-top:1px solid #eee;margin:12px 0">
        <h3>자동화 연동 가이드</h3>
        <div class="small">외부 프로그램에서 POST /api/posts 호출 + X-API-Key 사용</div>
        <div class="out">POST /api/posts
Headers: X-API-Key: {api_key}
Body: {"title":"...","content":"&lt;p&gt;...&lt;/p&gt;","category":"...","status":"published"}</div>
      </div>
    </div>

    <!-- 통계 -->
    <div id="panel-stats" style="display:none">
      <div class="card">
        <h3>블로그 통계</h3>
        <div id="statsContent" style="margin-top:8px">
          <div style="color:#999;text-align:center;padding:20px">로딩 중...</div>
        </div>
      </div>
    </div>

    <div id="seoOverlay" class="seo-overlay" style="display:none">
      <div class="seo-popup">
        <div class="seo-popup-header"><span>SEO 분석 결과</span><button class="btn light" onclick="closeSeoPopup()" style="padding:4px 10px;font-size:.8rem">닫기</button></div>
        <div class="seo-popup-body" id="seoPopupBody"></div>
        <div class="seo-popup-footer">
          <button class="btn light" onclick="closeSeoPopup()">수동 수정</button>
          <button class="btn" onclick="applySeoOptimize()">자동 최적화 적용</button>
        </div>
      </div>
    </div>
    <section class="card" style="margin-top:14px"><h3>응답 로그</h3><div class="out" id="out">ready</div></section>
  </div>
</div>

<script>
var outEl = document.getElementById('out');
var tabList = [
  {id:'editor',label:'글쓰기'},
  {id:'manage',label:'글 관리'},
  {id:'stats',label:'통계'},
  {id:'settings',label:'설정'},
  {id:'seo',label:'SEO'}
];
var currentPostId = null;
var currentStatus = 'published';
var sourceMode = false;
var autoSaveTimer = null;
var lastSavedContent = '';

function show(d){if(outEl)outEl.textContent=typeof d==='string'?d:JSON.stringify(d,null,2)}
window.addEventListener('error',function(e){show({error:'runtime_error',message:e&&e.message?e.message:String(e)})});
window.addEventListener('unhandledrejection',function(e){show({error:'promise_rejection',message:e&&e.reason?String(e.reason):'unknown'})});
function token(){return localStorage.getItem('admin_token')||''}
function authJson(){return {'Content-Type':'application/json','Authorization':'Bearer '+token()}}
function authBearer(){return {'Authorization':'Bearer '+token()}}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}

/* === Tabs === */
function mountTabs(){
  var el=document.getElementById('tabs');
  el.innerHTML=tabList.map(function(t,i){
    return '<button class="tab '+(i===0?'active':'')+'" data-tab="'+t.id+'">'+t.label+'</button>';
  }).join('');
  el.onclick=function(e){
    var b=e.target.closest('.tab'); if(!b) return;
    switchTab(b.dataset.tab);
  };
}

function switchTab(tabId){
  document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
  var btn=document.querySelector('.tab[data-tab="'+tabId+'"]');
  if(btn) btn.classList.add('active');
  var panels=['editor','manage','stats','settings','seo'];
  panels.forEach(function(p){
    var el=document.getElementById('panel-'+p);
    if(el) el.style.display=(p===tabId)?'block':'none';
  });
  if(tabId==='stats') loadStats();
}

/* === Auth === */
async function login(){
  var pwEl=document.getElementById('pw');
  var btn=document.getElementById('loginBtn');
  var pw=(pwEl&&pwEl.value)||'';
  if(!pw.trim()){
    alert('비밀번호를 입력하세요.');
    if(pwEl) pwEl.focus();
    return;
  }
  if(btn){btn.disabled=true;btn.textContent='로그인 중...'}
  try{
    var r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
    var d={};
    try{d=await r.json()}catch(_){d={error:'invalid_response'}}
    if(r.ok&&d.token){
      localStorage.setItem('admin_token',d.token);
      await initAdminApp();
    } else {
      alert('로그인 실패: '+(d.error||'비밀번호 확인 필요'));
    }
    show(d);
  } catch(e){
    var msg=String(e&&e.message?e.message:e);
    alert('로그인 요청 실패: '+msg);
    show({error:'network_error',detail:msg});
  } finally {
    if(btn){btn.disabled=false;btn.textContent='로그인'}
  }
}

async function logout(){
  await fetch('/api/auth/logout',{method:'POST',headers:authJson()});
  localStorage.removeItem('admin_token');
  location.reload();
}

/* === Editor Commands === */
function fmt(cmd,ui,val){
  document.execCommand(cmd,ui||false,val||null);
  document.getElementById('editorArea').focus();
  updateToolbarState();
}

function updateToolbarState(){
  var cmds=['bold','italic','underline','strikethrough','insertUnorderedList','insertOrderedList','justifyLeft','justifyCenter','justifyRight'];
  cmds.forEach(function(c){
    var el=document.getElementById('tb-'+c);
    if(el){
      if(document.queryCommandState(c)) el.classList.add('on');
      else el.classList.remove('on');
    }
  });
}

function insertLink(){
  var url=prompt('링크 URL을 입력하세요','https://');
  if(url) document.execCommand('createLink',false,url);
}

function applyFontSizePx(px){
  var n=parseInt(px,10);
  if(!n||n<8||n>72) return;
  document.execCommand('styleWithCSS',false,true);
  document.execCommand('fontSize',false,'7');
  var area=document.getElementById('editorArea');
  area.querySelectorAll('font[size="7"]').forEach(function(el){
    el.removeAttribute('size');
    el.style.fontSize=n+'px';
  });
  area.focus();
}

function applyTextColor(color){
  if(!color) return;
  document.execCommand('styleWithCSS',false,true);
  document.execCommand('foreColor',false,color);
  document.getElementById('editorArea').focus();
}

function clearInlineStyle(){
  document.execCommand('removeFormat',false,null);
  document.getElementById('editorArea').focus();
}

function utcToLocalStr(s){if(!s)return '';var utcStr=String(s).trim().replace(' ','T');if(utcStr.length<=19&&!utcStr.endsWith('Z'))utcStr+='Z';var d=new Date(utcStr);if(!isFinite(d.getTime()))return String(s).slice(0,16).replace('T',' ');return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}

function formatLocalDateTimeValue(input){
  if(!input) return '';
  var s=String(input).trim();
  if(!s) return '';
  var utcStr=s.replace(' ','T');
  if(utcStr.length<=19&&!utcStr.endsWith('Z'))utcStr+='Z';
  var d=new Date(utcStr);
  if(!isFinite(d.getTime())) return '';
  var y=d.getFullYear();
  var m=String(d.getMonth()+1).padStart(2,'0');
  var day=String(d.getDate()).padStart(2,'0');
  var h=String(d.getHours()).padStart(2,'0');
  var min=String(d.getMinutes()).padStart(2,'0');
  return y+'-'+m+'-'+day+'T'+h+':'+min;
}

function setPublishWindowLimits(){
  var el=document.getElementById('publish_at');
  if(!el) return;
  var now=new Date();
  now.setSeconds(0,0);
  var max=new Date(now.getTime()+50*24*60*60*1000);
  var toLocal=function(d){
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,'0');
    var day=String(d.getDate()).padStart(2,'0');
    var h=String(d.getHours()).padStart(2,'0');
    var min=String(d.getMinutes()).padStart(2,'0');
    return y+'-'+m+'-'+day+'T'+h+':'+min;
  };
  el.min=toLocal(now);
  el.max=toLocal(max);
}

function onStatusChange(){
  var st=document.getElementById('status').value;
  var wrap=document.getElementById('publishAtWrap');
  var input=document.getElementById('publish_at');
  if(!wrap||!input) return;
  if(st==='scheduled'){
    wrap.style.display='block';
    if(!input.value){
      var d=new Date(Date.now()+10*60*1000);
      d.setSeconds(0,0);
      input.value=formatLocalDateTimeValue(d.toISOString());
    }
  } else {
    wrap.style.display='none';
  }
}

function getEditorContent(){
  if(sourceMode) return document.getElementById('sourceArea').value;
  deselectImage();
  var area=document.getElementById('editorArea');
  var popups=area.querySelectorAll('.img-size-popup');
  popups.forEach(function(p){p.remove()});
  return area.innerHTML;
}

function extractBodyHtml(raw){
  var html=String(raw||'').trim();
  if(!html) return '';
  var bodyM=html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
  if(bodyM){
    html=bodyM[1].trim();
  } else if(/^<!doctype\s|^<html[\s>]/i.test(html)){
    html=html
      .replace(/^<!doctype[^>]*>/i,'')
      .replace(/<\\/?html[^>]*>/gi,'')
      .replace(/<head[\\s\\S]*?<\\/head>/gi,'')
      .replace(/<\\/?body[^>]*>/gi,'')
      .trim();
  }
  html=html.replace(/<script[\\s\\S]*?<\\/script>/gi,'');
  return html;
}

function toggleSource(){
  var area=document.getElementById('editorArea');
  var src=document.getElementById('sourceArea');
  if(!sourceMode){
    src.value=area.innerHTML;
    area.style.display='none';
    src.style.display='block';
    sourceMode=true;
  } else {
    var cleaned=extractBodyHtml(src.value);
    area.innerHTML=cleaned;
    src.value=cleaned;
    src.style.display='none';
    area.style.display='block';
    sourceMode=false;
    updateCharCount();
  }
}

function insertNodeAtCaret(node){
  var sel=window.getSelection();
  var area=document.getElementById('editorArea');
  if(!sel||!sel.rangeCount){area.appendChild(node);return}
  var range=sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.setEndAfter(node);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* === Image Upload === */
async function uploadImage(file){
  var fd=new FormData();
  fd.append('file',file);
  var r=await fetch('/api/media/upload',{method:'POST',headers:authBearer(),body:fd});
  var d=await r.json();
  if(!d.success){show(d);return null}
  return d;
}

async function insertUploadedImage(file){
  var placeholder=document.createElement('div');
  placeholder.className='img-uploading';
  placeholder.textContent='이미지 업로드 중...';
  insertNodeAtCaret(placeholder);
  var result=await uploadImage(file);
  if(!result){
    placeholder.textContent='업로드 실패';
    setTimeout(function(){placeholder.remove()},2000);
    return;
  }
  var img=document.createElement('img');
  img.src=result.url;
  img.alt='';
  img.loading='lazy';
  placeholder.replaceWith(img);
  show('이미지 업로드 완료: '+result.key);
}

function openImagePicker(){
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.multiple=true;
  input.onchange=function(){
    for(var i=0;i<input.files.length;i++){
      insertUploadedImage(input.files[i]);
    }
  };
  input.click();
}

function pickThumbnail(){
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.onchange=async function(){
    if(!input.files.length) return;
    var result=await uploadImage(input.files[0]);
    if(result){
      document.getElementById('thumbnail').value=result.url;
      var prev=document.getElementById('thumbPreview');
      prev.src=result.url;
      prev.classList.add('show');
      show('썸네일 업로드 완료');
    }
  };
  input.click();
}

function pickProfileImage(){
  var input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.onchange=async function(){
    if(!input.files.length) return;
    var result=await uploadImage(input.files[0]);
    if(result){
      document.getElementById('s_profile_image').value=result.url;
      var prev=document.getElementById('profileImgPreview');
      prev.src=result.url;
      prev.style.display='block';
      show('프로필 이미지 업로드 완료');
    }
  };
  input.click();
}

/* === Image Resize === */
var _imgPopup=null;
var _selectedImg=null;

function initImageResize(){
  var area=document.getElementById('editorArea');
  area.addEventListener('click',function(e){
    if(e.target.tagName==='IMG'&&area.contains(e.target)){
      selectImage(e.target);
    } else {
      deselectImage();
    }
  });
}

function selectImage(img){
  deselectImage();
  _selectedImg=img;
  img.classList.add('img-selected');
  var popup=document.createElement('div');
  popup.className='img-size-popup';
  popup.innerHTML='<button onclick="resizeImg(25)">25%</button><button onclick="resizeImg(50)">50%</button><button onclick="resizeImg(75)">75%</button><button onclick="resizeImg(100)">100%</button><span class="img-popup-sep"></span><button class="img-thumb-btn" onclick="setAsThumb()">썸네일 설정</button>';
  var rect=img.getBoundingClientRect();
  var areaRect=document.getElementById('editorArea').getBoundingClientRect();
  popup.style.top=(rect.top-areaRect.top-40)+'px';
  popup.style.left=(rect.left-areaRect.left)+'px';
  document.getElementById('editorArea').style.position='relative';
  document.getElementById('editorArea').appendChild(popup);
  _imgPopup=popup;
}

function setAsThumb(){
  if(!_selectedImg) return;
  var src=_selectedImg.src;
  document.getElementById('thumbnail').value=src;
  var prev=document.getElementById('thumbPreview');
  prev.src=src;
  prev.classList.add('show');
  show('썸네일이 설정되었습니다');
  deselectImage();
}

function deselectImage(){
  if(_selectedImg) _selectedImg.classList.remove('img-selected');
  if(_imgPopup) _imgPopup.remove();
  _selectedImg=null;
  _imgPopup=null;
}

function resizeImg(pct){
  if(!_selectedImg) return;
  _selectedImg.style.maxWidth=pct+'%';
  _selectedImg.style.width=pct+'%';
  deselectImage();
}

/* === Paste & Drop === */
function initEditorEvents(){
  var area=document.getElementById('editorArea');
  area.addEventListener('paste',function(e){
    var cb=e.clipboardData||window.clipboardData;
    if(!cb) return;
    var items=cb.items||[];
    for(var i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        e.preventDefault();
        var file=items[i].getAsFile();
        if(file) insertUploadedImage(file);
        return;
      }
    }
    /* HTML 코드를 텍스트로 붙여넣기한 경우 자동 변환 */
    var plain=(cb.getData('text/plain')||'').trim();
    var hasHtmlMime=cb.types&&cb.types.indexOf('text/html')>=0;
    if(!hasHtmlMime&&plain&&/^<(!DOCTYPE|html|head|body|div|p|h[1-6]|article|section|style|table|ul|ol)/i.test(plain)){
      e.preventDefault();
      var cleaned=plain;
      /* 전체 HTML 문서이면 body 내용만 추출 */
      var bodyM=cleaned.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
      if(bodyM) cleaned=bodyM[1].trim();
      else{
        cleaned=cleaned.replace(/^<!doctype[^>]*>/i,'').replace(/<\\/?html[^>]*>/gi,'').replace(/<head[\\s\\S]*?<\\/head>/gi,'').replace(/<\\/?body[^>]*>/gi,'');
      }
      /* script 태그 제거 (보안) */
      cleaned=cleaned.replace(/<script[\\s\\S]*?<\\/script>/gi,'');
      document.execCommand('insertHTML',false,cleaned.trim());
    }
  });
  area.addEventListener('dragover',function(e){
    e.preventDefault();
    e.dataTransfer.dropEffect='copy';
    area.classList.add('drag-over');
  });
  area.addEventListener('dragleave',function(){area.classList.remove('drag-over')});
  area.addEventListener('drop',function(e){
    e.preventDefault();
    area.classList.remove('drag-over');
    var files=e.dataTransfer.files;
    for(var i=0;i<files.length;i++){
      if(files[i].type.indexOf('image')!==-1) insertUploadedImage(files[i]);
    }
  });
  area.addEventListener('input',function(){
    updateCharCount();
    scheduleAutoSave();
  });
  document.addEventListener('selectionchange',updateToolbarState);
  initImageResize();
}

/* === Auto Save === */
function scheduleAutoSave(){
  if(autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(doAutoSave,5000);
}

async function doAutoSave(){
  var content=getEditorContent();
  var title=document.getElementById('title').value;
  if(!title&&!content) return;
  if(content===lastSavedContent) return;
  var payload={
    title:title||'(제목 없음)',
    category:document.getElementById('category').value,
    thumbnail:document.getElementById('thumbnail').value,
    content:content,
    status:'draft',
    publish_at:'',
    source:'manual'
  };
  var r;
  if(currentPostId){
    r=await fetch('/api/posts/'+currentPostId,{method:'PUT',headers:authJson(),body:JSON.stringify(payload)});
  } else {
    r=await fetch('/api/posts',{method:'POST',headers:authJson(),body:JSON.stringify(payload)});
  }
  var d=await r.json();
  if(d.post){
    currentPostId=d.post.id;
    lastSavedContent=content;
    var now=new Date();
    document.getElementById('autoSaveStatus').textContent='자동저장 '+now.getHours()+':'+String(now.getMinutes()).padStart(2,'0');
  }
}

function updateCharCount(){
  var text=(document.getElementById('editorArea').innerText||'').trim();
  document.getElementById('charCount').textContent=text.length.toLocaleString()+'자';
}

/* === Posts === */
function newPost(){
  currentPostId=null;
  lastSavedContent='';
  document.getElementById('title').value='';
  document.getElementById('category').value='';
  document.getElementById('thumbnail').value='';
  document.getElementById('editorArea').innerHTML='';
  document.getElementById('sourceArea').value='';
  document.getElementById('status').value='published';
  document.getElementById('publish_at').value='';
  document.getElementById('autoSaveStatus').textContent='-';
  onStatusChange();
  updateCharCount();
  if(sourceMode) toggleSource();
}

async function savePost(){
  var btn=document.getElementById('saveBtn');
  if(btn){btn.disabled=true;btn.textContent='저장 중...'}
  try{
    var st=document.getElementById('status').value;
    var publishAtRaw=document.getElementById('publish_at').value;
    var publishAt=publishAtRaw?new Date(publishAtRaw).toISOString():'';
    var title=(document.getElementById('title').value||'').trim();
    var content=getEditorContent();
    if(!title){alert('제목을 입력하세요.');return}
    if(!String(content||'').trim()){alert('내용을 입력하세요.');return}
    if(st==='scheduled'&&!publishAt){
      alert('예약발행은 예약 시간을 입력해야 합니다.');
      return;
    }
    var payload={
      title:title,
      category:document.getElementById('category').value,
      thumbnail:document.getElementById('thumbnail').value,
      content:content,
      status:st,
      publish_at:publishAt,
      source:'manual'
    };
    var r;
    if(currentPostId){
      r=await fetch('/api/posts/'+currentPostId,{method:'PUT',headers:authJson(),body:JSON.stringify(payload)});
    } else {
      r=await fetch('/api/posts',{method:'POST',headers:authJson(),body:JSON.stringify(payload)});
    }
    var d={};
    try{d=await r.json()}catch(_){d={error:'invalid_response'}}
    if(r.status===401){
      alert('로그인이 만료되었습니다. 다시 로그인하세요.');
      localStorage.removeItem('admin_token');
      location.reload();
      return;
    }
    if(!r.ok||d.error){
      alert('저장 실패: '+(d.error||('HTTP '+r.status)));
      show(d);
      return;
    }
    if(d.post){
      currentPostId=d.post.id;
      lastSavedContent=getEditorContent();
      document.getElementById('autoSaveStatus').textContent='저장 완료';
      if(st!=='draft'){
        window.location.href='/';
        return;
      }
    }
    show(d);
    loadPosts(currentStatus);
  } catch(e){
    var msg=String(e&&e.message?e.message:e);
    alert('저장 중 오류: '+msg);
    show({error:'save_failed',detail:msg});
  } finally {
    if(btn){btn.disabled=false;btn.textContent='저장/발행'}
  }
}

async function saveDraft(){
  var prev=document.getElementById('status').value;
  document.getElementById('status').value='draft';
  onStatusChange();
  await savePost();
  document.getElementById('status').value=prev;
  onStatusChange();
}

async function exportHtml(){
  if(!currentPostId){alert('먼저 글을 저장하세요.');return}
  window.open('/api/posts/'+currentPostId+'/export','_blank');
}

async function loadPosts(status){
  currentStatus=status||currentStatus;
  var r=await fetch('/api/posts?status='+encodeURIComponent(currentStatus),{headers:authJson()});
  var d=await r.json();
  var list=document.getElementById('postList');
  if(!d.posts){list.innerHTML='<div class="item">불러오기 실패</div>';show(d);return}
  list.innerHTML=d.posts.map(function(p){
    var shownAt=utcToLocalStr(p.publish_at||p.created_at||'');
    return '<div class="item"><div><div class="title">'+esc(p.title)+'</div><div class="meta">'+
    esc(p.category||'일반')+' · '+esc(shownAt||'')+' · '+esc(p.status)+
    '</div></div><div class="tools"><button class="btn light" onclick="editPost('+p.id+')">수정</button>'+
    '<button class="btn light" onclick="removePost('+p.id+')">삭제</button></div></div>';
  }).join('')||'<div class="item">글 없음</div>';
}

async function editPost(id){
  var r=await fetch('/api/posts/'+id,{headers:authJson()});
  var d=await r.json();
  if(!d.post){show(d);return}
  currentPostId=d.post.id;
  lastSavedContent=d.post.content||'';
  document.getElementById('title').value=d.post.title||'';
  document.getElementById('category').value=d.post.category||'';
  document.getElementById('thumbnail').value=d.post.thumbnail||'';
  var prev=document.getElementById('thumbPreview');
  if(d.post.thumbnail){prev.src=d.post.thumbnail;prev.classList.add('show')}else{prev.classList.remove('show')}
  document.getElementById('editorArea').innerHTML=d.post.content||'';
  document.getElementById('status').value=d.post.status||'published';
  document.getElementById('publish_at').value=formatLocalDateTimeValue(d.post.publish_at||'');
  onStatusChange();
  if(sourceMode) toggleSource();
  updateCharCount();
  show('글 불러옴: '+id);
  switchTab('editor');
}

async function removePost(id){
  if(!confirm('삭제할까요?'))return;
  var r=await fetch('/api/posts/'+id,{method:'DELETE',headers:authJson()});
  var d=await r.json();
  if(d.success){
    if(currentPostId===id){currentPostId=null;newPost()}
    window.location.href='/';
    return;
  }
  show(d);
}

/* === Settings === */
async function loadSettings(){
  var r=await fetch('/api/settings',{headers:authJson()});
  var d=await r.json();
  if(!d.settings){show(d);return}
  Object.keys(d.settings).forEach(function(k){
    var el=document.getElementById('s_'+k);
    if(el) el.value=d.settings[k]||'';
  });
  /* 프로필 이미지 미리보기 */
  var pimg=d.settings.profile_image;
  if(pimg){var prev=document.getElementById('profileImgPreview');if(prev){prev.src=pimg;prev.style.display='block'}}
  /* 카테고리 드롭다운 채우기 */
  var cats=(d.settings.categories||'일반').split(',').map(function(c){return c.trim()}).filter(Boolean);
  window._categories=cats;
  var sel=document.getElementById('category');
  var cur=sel.value;
  sel.innerHTML='<option value="">선택</option>'+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
  if(cur) sel.value=cur;
}

/* === 카테고리 관리 팝업 === */
function openCatPopup(){
  renderCatList();
  document.getElementById('catOverlay').style.display='flex';
  document.getElementById('catNewInput').value='';
}
function closeCatPopup(){
  document.getElementById('catOverlay').style.display='none';
}
function renderCatList(){
  var cats=window._categories||[];
  var html='';
  if(cats.length===0){html='<div style="color:#999;text-align:center;padding:20px">카테고리가 없습니다. 아래에서 추가하세요.</div>'}
  else{
    cats.forEach(function(c,i){
      html+='<div class="cat-item"><input id="catEdit'+i+'" value="'+esc(c)+'"><div class="cat-item-btns"><button class="save" onclick="renameCat('+i+')">저장</button><button class="del" onclick="deleteCat('+i+')">삭제</button></div></div>';
    });
  }
  document.getElementById('catList').innerHTML=html;
}
async function saveCatsToServer(cats){
  window._categories=cats;
  var sel=document.getElementById('category');
  var cur=sel.value;
  sel.innerHTML='<option value="">선택</option>'+cats.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
  if(cur) sel.value=cur;
  /* 설정 탭의 카테고리 필드도 동기화 */
  var scat=document.getElementById('s_categories');
  if(scat) scat.value=cats.join(',');
  /* 서버 저장 */
  await fetch('/api/settings',{method:'PUT',headers:authJson(),body:JSON.stringify({categories:cats.join(',')})});
}
async function addCategory(){
  var inp=document.getElementById('catNewInput');
  var name=inp.value.trim();
  if(!name){inp.focus();return}
  var cats=(window._categories||[]).slice();
  if(cats.indexOf(name)>=0){alert('이미 존재하는 카테고리입니다.');return}
  cats.push(name);
  await saveCatsToServer(cats);
  renderCatList();
  inp.value='';
  inp.focus();
}
async function renameCat(i){
  var inp=document.getElementById('catEdit'+i);
  var name=inp.value.trim();
  if(!name){alert('이름을 입력하세요.');inp.focus();return}
  var cats=(window._categories||[]).slice();
  if(cats[i]===name)return;
  if(cats.indexOf(name)>=0){alert('이미 존재하는 카테고리입니다.');return}
  cats[i]=name;
  await saveCatsToServer(cats);
  renderCatList();
}
async function deleteCat(i){
  var cats=(window._categories||[]).slice();
  if(!confirm('"'+cats[i]+'" 카테고리를 삭제할까요?'))return;
  cats.splice(i,1);
  await saveCatsToServer(cats);
  renderCatList();
}

async function saveSettings(){
  var payload={
    blog_name:document.getElementById('s_blog_name').value,
    blog_description:document.getElementById('s_blog_description').value,
    profile_name:document.getElementById('s_profile_name').value,
    profile_image:document.getElementById('s_profile_image').value,
    theme_color:document.getElementById('s_theme_color').value,
    font_family:document.getElementById('s_font_family').value,
    font_size_px:document.getElementById('s_font_size_px').value,
    categories:document.getElementById('s_categories').value,
    adsense_code:document.getElementById('s_adsense_code').value,
    ad_top_html:document.getElementById('s_ad_top_html').value,
    ad_mid_html:document.getElementById('s_ad_mid_html').value,
    ad_bottom_html:document.getElementById('s_ad_bottom_html').value,
    google_verification:document.getElementById('s_google_verification').value,
    naver_verification:document.getElementById('s_naver_verification').value,
    naver_client_id:document.getElementById('s_naver_client_id').value,
    naver_client_secret:document.getElementById('s_naver_client_secret').value,
    indexnow_key:document.getElementById('s_indexnow_key').value,
    api_key:document.getElementById('s_api_key').value,
    turtlebuff_api_key:document.getElementById('s_turtlebuff_api_key').value,
    admin_password:document.getElementById('s_admin_password').value
  };
  var r=await fetch('/api/settings',{method:'PUT',headers:authJson(),body:JSON.stringify(payload)});
  var d=await r.json();
  show(d);
  if(d.settings){
    document.getElementById('s_api_key').value=d.settings.api_key||'';
    document.getElementById('s_turtlebuff_api_key').value=d.settings.turtlebuff_api_key||'';
  }
}

/* === Stats === */
async function loadStats(){
  var el=document.getElementById('statsContent');
  el.innerHTML='<div style="color:#999;text-align:center;padding:20px">로딩 중...</div>';
  try{
    var r=await fetch('/api/stats',{headers:authJson()});
    var d=await r.json();
    if(!d.stats){el.innerHTML='<div style="color:#e53e3e">통계 로딩 실패</div>';return}
    var s=d.stats;
    var html='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px">';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.total_posts)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">전체 글</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.published_posts)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">발행됨</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.scheduled_posts||0)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">예약됨</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.draft_posts)+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">임시저장</div></div>';
    html+='<div style="background:#f5f5f7;padding:16px;border-radius:12px;text-align:center"><div style="font-size:1.8rem;font-weight:800">'+Number(s.total_views).toLocaleString()+'</div><div style="font-size:.78rem;color:#86868b;margin-top:4px">총 조회수</div></div>';
    html+='</div>';
    /* 인기글 TOP 10 */
    if(s.top_posts&&s.top_posts.length){
      html+='<h4 style="margin:0 0 8px;font-size:.92rem;font-weight:700">인기 글 TOP 10</h4>';
      html+='<div style="border:1px solid #e8e8ed;border-radius:12px;overflow:hidden">';
      s.top_posts.forEach(function(p,i){
        html+='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f2;font-size:.88rem">';
        html+='<div><span style="color:#86868b;font-weight:700;margin-right:8px">'+(i+1)+'</span>'+esc(p.title)+'</div>';
        html+='<div style="font-weight:700;white-space:nowrap;color:#0071e3">'+Number(p.views||0).toLocaleString()+' views</div>';
        html+='</div>';
      });
      html+='</div>';
    }
    /* 카테고리별 통계 */
    if(s.category_stats&&s.category_stats.length){
      html+='<h4 style="margin:18px 0 8px;font-size:.92rem;font-weight:700">카테고리별 현황</h4>';
      html+='<div style="border:1px solid #e8e8ed;border-radius:12px;overflow:hidden">';
      s.category_stats.forEach(function(c){
        html+='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f2;font-size:.88rem">';
        html+='<div style="font-weight:600">'+esc(c.category)+'</div>';
        html+='<div style="color:#86868b">'+c.cnt+'개 / '+Number(c.views||0).toLocaleString()+' views</div>';
        html+='</div>';
      });
      html+='</div>';
    }
    /* 최근 글 */
    if(s.recent_posts&&s.recent_posts.length){
      html+='<h4 style="margin:18px 0 8px;font-size:.92rem;font-weight:700">최근 글</h4>';
      html+='<div style="border:1px solid #e8e8ed;border-radius:12px;overflow:hidden">';
      s.recent_posts.forEach(function(p){
        var badge=p.status==='published'?'<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:600">발행</span>':'<span style="background:#fef3c7;color:#d97706;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:600">임시</span>';
        html+='<div style="padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f0f0f2;font-size:.85rem">';
        html+='<div style="display:flex;align-items:center;gap:8px">'+badge+'<span>'+esc(p.title)+'</span></div>';
        html+='<div style="color:#86868b;font-size:.78rem;white-space:nowrap">'+esc(utcToLocalStr(p.created_at||'').slice(0,10))+'</div>';
        html+='</div>';
      });
      html+='</div>';
    }
    el.innerHTML=html;
  }catch(e){
    el.innerHTML='<div style="color:#e53e3e">오류: '+esc(String(e))+'</div>';
  }
}

/* === SEO === */
async function analyzeSeo(){
  var payload={
    title:document.getElementById('title').value,
    content:getEditorContent(),
    keyword:document.getElementById('seo_keyword').value
  };
  var r=await fetch('/api/seo/analyze',{method:'POST',headers:authJson(),body:JSON.stringify(payload)});
  var d=await r.json();
  document.getElementById('seoOut').textContent=JSON.stringify(d,null,2);
}

async function optimizeCurrent(){
  if(!currentPostId){alert('수정 중인 글이 없습니다.');return}
  var keyword=document.getElementById('seo_keyword').value;
  if(!keyword){alert('키워드를 입력하세요.');return}
  var r=await fetch('/api/posts/'+currentPostId+'/optimize',{method:'POST',headers:authJson(),body:JSON.stringify({keyword:keyword})});
  var d=await r.json();
  document.getElementById('seoOut').textContent=JSON.stringify(d,null,2);
  if(d.post){
    document.getElementById('title').value=d.post.title||'';
    document.getElementById('editorArea').innerHTML=d.post.content||'';
    updateCharCount();
  }
}

/* === SEO Popup from Editor === */
var _seoKeywordCache='';

async function seoAnalyzeFromEditor(){
  var keyword=(document.getElementById('seoKeyword').value||'').trim();
  if(!keyword){alert('SEO 키워드를 입력하세요.');return}
  _seoKeywordCache=keyword;
  var title=document.getElementById('title').value;
  var content=getEditorContent();
  if(!title&&!content){alert('제목이나 내용을 먼저 입력하세요.');return}
  /* 1) 임시저장 */
  var payload={title:title||'(제목 없음)',category:document.getElementById('category').value,thumbnail:document.getElementById('thumbnail').value,content:content,status:'draft',source:'manual'};
  var sr;
  if(currentPostId){sr=await fetch('/api/posts/'+currentPostId,{method:'PUT',headers:authJson(),body:JSON.stringify(payload)})}
  else{sr=await fetch('/api/posts',{method:'POST',headers:authJson(),body:JSON.stringify(payload)})}
  var sd=await sr.json();
  if(sd.post){currentPostId=sd.post.id;lastSavedContent=content;document.getElementById('autoSaveStatus').textContent='임시저장됨'}
  /* 2) SEO 분석 */
  var r=await fetch('/api/seo/analyze',{method:'POST',headers:authJson(),body:JSON.stringify({title:title,content:content,keyword:keyword})});
  var d=await r.json();
  if(!d.success){show(d);return}
  /* 3) 팝업 표시 */
  var local=d.local||{};
  var naver=d.naver||{};
  var scoreClass=local.score>=80?'good':local.score>=50?'mid':'bad';
  var html='<div class="seo-score '+scoreClass+'">'+local.score+'/100</div>';
  html+='<div style="font-size:.88rem;color:#777;margin-bottom:12px">제목 '+local.title_length+'자 / 본문 '+local.body_length+'자 / 키워드 밀도 '+local.keyword_density_percent+'%</div>';
  if(local.suggestions&&local.suggestions.length){
    html+='<ul class="seo-list">';
    local.suggestions.forEach(function(s){html+='<li>'+esc(s)+'</li>'});
    html+='</ul>';
  } else {
    html+='<div style="color:#22c55e;font-weight:700;margin:8px 0">SEO 상태 양호!</div>';
  }
  if(naver&&naver.ok){
    html+='<div style="margin-top:12px;padding:10px;background:#f5f5f7;border-radius:10px;font-size:.85rem">';
    html+='<b>네이버 검색량:</b> '+Number(naver.result_count||0).toLocaleString()+'건';
    if(naver.sample_titles&&naver.sample_titles.length){
      html+='<div style="margin-top:6px;color:#777">상위 결과: '+naver.sample_titles.map(function(t){return esc(t)}).join(', ')+'</div>';
    }
    html+='</div>';
  }
  document.getElementById('seoPopupBody').innerHTML=html;
  document.getElementById('seoOverlay').style.display='flex';
}

function closeSeoPopup(){
  document.getElementById('seoOverlay').style.display='none';
}

function initAdminApp(){
  document.getElementById('loginCard').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  mountTabs();
  initEditorEvents();
  setPublishWindowLimits();
  onStatusChange();
  return Promise.all([loadSettings(),loadPosts('published')]).then(function(){
    var h=location.hash||'';
    if(h.indexOf('#edit-')===0){var id=parseInt(h.slice(6));if(id)editPost(id)}
    if(h.indexOf('#del-')===0){var id=parseInt(h.slice(5));if(id)removePost(id)}
  });
}

async function applySeoOptimize(){
  if(!currentPostId){alert('글이 저장되지 않았습니다.');closeSeoPopup();return}
  var keyword=_seoKeywordCache;
  if(!keyword){alert('키워드가 없습니다.');closeSeoPopup();return}
  closeSeoPopup();
  var r=await fetch('/api/posts/'+currentPostId+'/optimize',{method:'POST',headers:authJson(),body:JSON.stringify({keyword:keyword})});
  var d=await r.json();
  if(d.post){
    document.getElementById('title').value=d.post.title||'';
    document.getElementById('editorArea').innerHTML=d.post.content||'';
    lastSavedContent=d.post.content||'';
    updateCharCount();
    show('SEO 자동 최적화 적용 완료');
  } else {
    show(d);
  }
}

/* === Init === */
if(token()){
  initAdminApp();
}
</script>
</body>
</html>`;
}

/* ──── 🎨 [수정 가능] 404 페이지 ────────────────────────────────────────────────
   페이지를 찾을 수 없을 때 표시되는 404 페이지입니다.
   ⚠️ 함수명 renderNotFoundPage() 유지 필수
   ────────────────────────────────────────────────────────────────────────────── */
function renderNotFoundPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>404</title></head><body style="font-family:system-ui;padding:32px"><h1>404</h1><p>페이지를 찾을 수 없습니다.</p><a href="/">홈으로</a></body></html>`;
}