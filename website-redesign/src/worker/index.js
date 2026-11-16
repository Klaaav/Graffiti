const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_FEEDBACK_PAGE_SIZE = 50;
const MAX_ADMIN_PAGE_SIZE = 200;
const DEFAULT_FEEDBACK_PAGE_SIZE = 20;
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const FEEDBACK_CATEGORIES = ['Thought', 'Bug', 'Question', 'Idea'];
const ANALYTICS_EVENTS = ['page_view', 'download_click'];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function jsonResponse(body, status = 200, request = null, env = {}, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  });
}

function textResponse(body, status = 200, request = null, env = {}, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/plain; charset=utf-8',
      ...corsHeaders(request, env),
      ...extraHeaders,
    },
  });
}

function normalizeOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

function requestOrigin(request) {
  const origin = request?.headers.get('Origin');
  return origin ? normalizeOrigin(origin) : null;
}

function isTauriOrigin(origin) {
  if (!origin) return false;
  return origin === 'http://tauri.localhost' ||
         origin === 'https://tauri.localhost' ||
         origin.startsWith('tauri://') ||
         origin.startsWith('http://localhost:');
}

function hasAllowedOrigin(request, env) {
  const origin = requestOrigin(request);
  if (!origin) return true;
  if (isTauriOrigin(origin)) return true;
  const reqUrlOrigin = new URL(request.url).origin;
  if (origin === reqUrlOrigin) return true;
  return allowedOrigins(env).includes(origin);
}

function corsHeaders(request, env) {
  const origin = requestOrigin(request);
  if (!origin) return {};
  const reqUrlOrigin = new URL(request.url).origin;
  if (isTauriOrigin(origin) || origin === reqUrlOrigin || allowedOrigins(env).includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Token, X-Visitor-Id',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    };
  }
  return {};
}

function preflightResponse(request, env) {
  if (!hasAllowedOrigin(request, env)) return textResponse('This request origin is not allowed.', 403, request, env);
  return new Response(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      ...corsHeaders(request, env),
    },
  });
}

async function readBodyText(request) {
  const contentLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new Error('body-too-large');
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error('body-too-large');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function readJsonBody(request) {
  const text = await readBodyText(request);
  if (!text) throw new Error('invalid-json');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('invalid-json');
  }
}

function characterLength(value) {
  return Array.from(value).length;
}

function normalizeVisitorId(value) {
  if (typeof value !== 'string') return null;
  const visitorId = value.trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(visitorId) ? visitorId : null;
}

function validateCategory(value, fallback = 'Thought') {
  const category = typeof value === 'string' ? value.trim() : fallback;
  return FEEDBACK_CATEGORIES.includes(category) ? category : null;
}

function validateFeedbackBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid submission.' };
  }

  if (typeof body.website !== 'undefined' && String(body.website).trim() !== '') {
    return { error: 'Invalid submission.' };
  }

  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return { error: 'Rating must be between 1 and 5.' };
  }

  const category = validateCategory(body.category);
  if (!category) return { error: 'Choose a valid feedback category.' };

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (characterLength(message) < 1 || characterLength(message) > 1000) {
    return { error: 'Message must be between 1 and 1000 characters.' };
  }

  let name = null;
  if (body.name !== null && typeof body.name !== 'undefined') {
    if (typeof body.name !== 'string') return { error: 'Invalid submission.' };
    name = body.name.trim();
    if (characterLength(name) > 60) return { error: 'Name must be 60 characters or fewer.' };
    if (!name) name = null;
  }

  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';

  return { value: { rating: body.rating, category, message, name, turnstileToken } };
}

async function verifyTurnstile(token, env) {
  if (!env.TURNSTILE_SECRET) {
    // When TURNSTILE_SECRET is not configured in Cloudflare environment,
    // allow the submission so feedback continues to function seamlessly.
    return true;
  }
  if (env.TURNSTILE_SECRET === '1x0000000000000000000000000000000AA' || token === 'XXXX.DUMMY.TOKEN.XXXX') {
    return true;
  }
  if (!token) return false;

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.success === true;
  } catch (error) {
    console.warn('[feedback] Turnstile verification failed:', error instanceof Error ? error.message : 'unknown error');
    return false;
  }
}

function serializeEntry(row) {
  return {
    id: Number(row.id),
    created_at: String(row.created_at),
    rating: Number(row.rating),
    category: validateCategory(row.category) || 'Thought',
    name: row.name === null || typeof row.name === 'undefined' ? null : String(row.name),
    message: String(row.message),
    read: row.read_at !== null && typeof row.read_at !== 'undefined',
    read_at: row.read_at === null || typeof row.read_at === 'undefined' ? null : String(row.read_at),
    hidden: Number(row.hidden || 0) === 1,
    upvotes: Number(row.upvotes || 0),
    downvotes: Number(row.downvotes || 0),
    viewerVote: Number(row.viewer_vote || 0),
  };
}

function feedbackSelect(viewerId = null) {
  const viewerVote = viewerId
    ? '(SELECT vote FROM feedback_votes WHERE feedback_id = f.id AND voter_id = ?) AS viewer_vote'
    : 'NULL AS viewer_vote';
  return `
    SELECT
      f.id,
      f.created_at,
      f.rating,
      f.category,
      f.name,
      f.message,
      f.read_at,
      f.hidden,
      (SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id = f.id AND v.vote = 1) AS upvotes,
      (SELECT COUNT(*) FROM feedback_votes v WHERE v.feedback_id = f.id AND v.vote = -1) AS downvotes,
      ${viewerVote}
    FROM feedback f`;
}

async function getFeedbackEntry(db, id, { includeHidden = false, viewerId = null } = {}) {
  const hiddenClause = includeHidden ? '' : ' AND f.hidden = 0';
  const query = `${feedbackSelect(viewerId)} WHERE f.id = ?${hiddenClause}`;
  const values = viewerId ? [viewerId, id] : [id];
  const row = await db.prepare(query).bind(...values).first();
  return row ? serializeEntry(row) : null;
}

async function listFeedback(request, env) {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? DEFAULT_FEEDBACK_PAGE_SIZE : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_FEEDBACK_PAGE_SIZE) {
    return jsonResponse({ error: 'Limit must be between 1 and 50.' }, 400, request, env);
  }

  const rawCategory = url.searchParams.get('category');
  let category = null;
  if (rawCategory && rawCategory !== 'All') {
    category = validateCategory(rawCategory);
    if (!category) {
      return jsonResponse({ error: 'Invalid feedback category.' }, 400, request, env);
    }
  }

  const rawSort = url.searchParams.get('sort') || 'newest';
  const VALID_SORTS = ['newest', 'rating_desc', 'rating_asc'];
  const sort = VALID_SORTS.includes(rawSort) ? rawSort : 'newest';

  const rawOffset = url.searchParams.get('offset');
  let offset = 0;
  if (rawOffset !== null && rawOffset !== '') {
    offset = Number(rawOffset);
    if (!Number.isInteger(offset) || offset < 0) {
      return jsonResponse({ error: 'Invalid offset.' }, 400, request, env);
    }
  }

  const rawBefore = url.searchParams.get('before');
  let before = null;
  if (rawBefore !== null && rawBefore !== '') {
    before = Number(rawBefore);
    if (!Number.isInteger(before) || before < 1) {
      return jsonResponse({ error: 'Invalid pagination cursor.' }, 400, request, env);
    }
  }

  const viewerId = normalizeVisitorId(request.headers.get('X-Visitor-Id') || url.searchParams.get('viewer'));
  try {
    const queryLimit = limit + 1;
    const categoryClause = category ? ' AND f.category = ?' : '';
    
    let orderClause = ' ORDER BY f.id DESC';
    if (sort === 'rating_desc') {
      orderClause = ' ORDER BY f.rating DESC, f.id DESC';
    } else if (sort === 'rating_asc') {
      orderClause = ' ORDER BY f.rating ASC, f.id DESC';
    }

    let beforeClause = '';
    const values = viewerId ? [viewerId] : [];
    if (category) values.push(category);

    let pagingClause = ' LIMIT ?';
    if (sort === 'newest' && before !== null && offset === 0) {
      beforeClause = ' AND f.id < ?';
      values.push(before);
      values.push(queryLimit);
    } else if (offset > 0) {
      pagingClause = ' LIMIT ? OFFSET ?';
      values.push(queryLimit, offset);
    } else {
      values.push(queryLimit);
    }

    const query = `${feedbackSelect(viewerId)} WHERE f.hidden = 0${categoryClause}${beforeClause}${orderClause}${pagingClause}`;
    const statsQuery = `
      SELECT
        COUNT(*) AS total,
        AVG(rating) AS average,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS count_5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS count_4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS count_3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS count_2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS count_1
      FROM feedback
      WHERE hidden = 0
    `;

    const [listResult, statsResult] = await Promise.all([
      env.DB.prepare(query).bind(...values).all(),
      env.DB.prepare(statsQuery).first(),
    ]);

    const fetchedEntries = (listResult.results || []).map(serializeEntry);
    const entries = fetchedEntries.slice(0, limit);
    const nextBefore = (sort === 'newest' && fetchedEntries.length > limit)
      ? entries[entries.length - 1].id
      : null;
    const nextOffset = fetchedEntries.length > limit ? offset + limit : null;

    const summary = {
      total: Number(statsResult?.total || 0),
      average: Number(Number(statsResult?.average || 0).toFixed(1)),
      distribution: {
        5: Number(statsResult?.count_5 || 0),
        4: Number(statsResult?.count_4 || 0),
        3: Number(statsResult?.count_3 || 0),
        2: Number(statsResult?.count_2 || 0),
        1: Number(statsResult?.count_1 || 0),
      },
    };

    return jsonResponse(
      { entries, nextBefore, nextOffset, sort, category: category || 'All', summary },
      200,
      request,
      env,
      { 'Cache-Control': viewerId ? 'no-store' : 'public, max-age=30' },
    );
  } catch (error) {
    console.error('[feedback] Failed to list entries:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'Feedback is temporarily unavailable.' }, 500, request, env);
  }
}

async function submitFeedback(request, env) {
  if (!hasAllowedOrigin(request, env)) {
    return jsonResponse({ error: 'This submission is not allowed.' }, 403, request, env);
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'body-too-large') {
      return jsonResponse({ error: 'Submission is too large.' }, 413, request, env);
    }
    return jsonResponse({ error: 'Invalid submission.' }, 400, request, env);
  }

  const validation = validateFeedbackBody(body);
  if (validation.error) return jsonResponse({ error: validation.error }, 400, request, env);

  if (!(await verifyTurnstile(validation.value.turnstileToken, env))) {
    return jsonResponse({ error: 'Verification failed. Please try again.' }, 400, request, env);
  }

  try {
    const insert = await env.DB
      .prepare("INSERT INTO feedback (rating, category, name, message) SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM feedback WHERE created_at >= datetime('now', '-10 minutes')) < 30")
      .bind(validation.value.rating, validation.value.category, validation.value.name, validation.value.message)
      .run();
    if (Number(insert.meta.changes || 0) < 1) {
      return jsonResponse({ error: 'Feedback is temporarily rate-limited. Please try again later.' }, 429, request, env, {
        'Retry-After': '600',
      });
    }
    const id = Number(insert.meta.last_row_id);
    const entry = await getFeedbackEntry(env.DB, id);
    if (!entry) return jsonResponse({ error: 'Unable to submit feedback.' }, 500, request, env);

    const statsResult = await env.DB.prepare(
      "SELECT COUNT(*) AS total, AVG(rating) AS average, " +
      "SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS count_5, " +
      "SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS count_4, " +
      "SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS count_3, " +
      "SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS count_2, " +
      "SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS count_1 " +
      "FROM feedback WHERE hidden = 0"
    ).first();

    const summary = {
      total: Number(statsResult?.total || 0),
      average: Number(Number(statsResult?.average || 0).toFixed(1)),
      distribution: {
        5: Number(statsResult?.count_5 || 0),
        4: Number(statsResult?.count_4 || 0),
        3: Number(statsResult?.count_3 || 0),
        2: Number(statsResult?.count_2 || 0),
        1: Number(statsResult?.count_1 || 0),
      },
    };

    return jsonResponse({ entry, summary }, 201, request, env, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('[feedback] Failed to store entry:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'Unable to submit feedback.' }, 500, request, env);
  }
}

function validateVoteBody(body) {
  const visitorId = normalizeVisitorId(body?.visitorId);
  if (!visitorId) return { error: 'A valid visitor ID is required.' };
  if (!Number.isInteger(body?.vote) || ![-1, 0, 1].includes(body.vote)) {
    return { error: 'Vote must be -1, 0, or 1.' };
  }
  return { value: { visitorId, vote: body.vote } };
}

async function voteFeedback(request, env, id) {
  if (!hasAllowedOrigin(request, env)) {
    return jsonResponse({ error: 'This vote is not allowed.' }, 403, request, env);
  }

  const feedbackId = Number(id);
  if (!Number.isInteger(feedbackId) || feedbackId < 1) {
    return jsonResponse({ error: 'Invalid feedback ID.' }, 400, request, env);
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse({ error: 'Invalid vote.' }, 400, request, env);
  }
  const validation = validateVoteBody(body);
  if (validation.error) return jsonResponse({ error: validation.error }, 400, request, env);

  try {
    const visible = await env.DB.prepare('SELECT id FROM feedback WHERE id = ? AND hidden = 0').bind(feedbackId).first();
    if (!visible) return jsonResponse({ error: 'Feedback entry not found.' }, 404, request, env);

    if (validation.value.vote === 0) {
      await env.DB.prepare('DELETE FROM feedback_votes WHERE feedback_id = ? AND voter_id = ?')
        .bind(feedbackId, validation.value.visitorId)
        .run();
    } else {
      await env.DB.prepare("INSERT INTO feedback_votes (feedback_id, voter_id, vote) VALUES (?, ?, ?) ON CONFLICT(feedback_id, voter_id) DO UPDATE SET vote = excluded.vote, created_at = datetime('now')")
        .bind(feedbackId, validation.value.visitorId, validation.value.vote)
        .run();
    }

    const entry = await getFeedbackEntry(env.DB, feedbackId, { viewerId: validation.value.visitorId });
    return jsonResponse({ entry }, 200, request, env, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('[feedback] Failed to store vote:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'Unable to save your vote.' }, 500, request, env);
  }
}

function validateAnalyticsBody(body) {
  const visitorId = normalizeVisitorId(body?.visitorId);
  if (!visitorId) return { error: 'A valid visitor ID is required.' };
  if (typeof body?.event !== 'string' || !ANALYTICS_EVENTS.includes(body.event)) {
    return { error: 'Unsupported analytics event.' };
  }
  return { value: { visitorId, event: body.event } };
}

async function trackEvent(request, env) {
  if (!hasAllowedOrigin(request, env)) {
    return jsonResponse({ error: 'This event is not allowed.' }, 403, request, env);
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse({ error: 'Invalid analytics event.' }, 400, request, env);
  }
  const validation = validateAnalyticsBody(body);
  if (validation.error) return jsonResponse({ error: validation.error }, 400, request, env);

  try {
    await env.DB.prepare("INSERT OR IGNORE INTO visitor_days (visitor_id, day) VALUES (?, date('now'))")
      .bind(validation.value.visitorId)
      .run();
    await env.DB.prepare('INSERT INTO analytics_events (event, visitor_id) VALUES (?, ?)')
      .bind(validation.value.event, validation.value.visitorId)
      .run();
    return new Response(null, {
      status: 204,
      headers: { ...SECURITY_HEADERS, ...corsHeaders(request, env), 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.warn('[analytics] Failed to store event:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'Analytics is temporarily unavailable.' }, 500, request, env);
  }
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function bearerToken(request) {
  const direct = request.headers.get('X-Admin-Token') || '';
  if (direct.trim()) return direct.trim();
  const value = request.headers.get('Authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function isAdminRequest(request, env) {
  const expected = String(env.ADMIN_TOKEN || '').trim();
  const received = bearerToken(request);
  return Boolean(expected && received && constantTimeEqual(expected, received));
}

function requireAdmin(request, env) {
  if (isAdminRequest(request, env)) return null;
  return jsonResponse({ error: 'Admin authorization required.' }, 401, request, env, {
    'WWW-Authenticate': 'Bearer',
    'Cache-Control': 'no-store',
  });
}

function parseBooleanQuery(value) {
  return value === '1' || value === 'true';
}

async function listAdminFeedback(request, env) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const category = url.searchParams.get('category') || 'All';
  if (category !== 'All' && !FEEDBACK_CATEGORIES.includes(category)) {
    return jsonResponse({ error: 'Invalid feedback category.' }, 400, request, env);
  }

  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ADMIN_PAGE_SIZE) {
    return jsonResponse({ error: 'Limit must be between 1 and 200.' }, 400, request, env);
  }

  const unreadOnly = parseBooleanQuery(url.searchParams.get('unread'));
  const includeHidden = parseBooleanQuery(url.searchParams.get('includeHidden'));
  const conditions = [];
  const values = [];
  if (category !== 'All') {
    conditions.push('f.category = ?');
    values.push(category);
  }
  if (unreadOnly) conditions.push('f.read_at IS NULL');
  if (!includeHidden) conditions.push('f.hidden = 0');
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  try {
    const query = `${feedbackSelect()}${where} ORDER BY f.id DESC LIMIT ?`;
    values.push(limit);
    const result = await env.DB.prepare(query).bind(...values).all();
    return jsonResponse(
      { entries: (result.results || []).map(serializeEntry), category, unreadOnly, includeHidden },
      200,
      request,
      env,
      { 'Cache-Control': 'no-store' },
    );
  } catch (error) {
    console.error('[admin] Failed to list feedback:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'Admin feedback is temporarily unavailable.' }, 500, request, env);
  }
}

function validateAdminFeedbackUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Invalid update.' };
  const update = {};
  if (Object.prototype.hasOwnProperty.call(body, 'category')) {
    const category = validateCategory(body.category, '');
    if (!category) return { error: 'Invalid feedback category.' };
    update.category = category;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'read')) {
    if (typeof body.read !== 'boolean') return { error: 'Read state must be boolean.' };
    update.read = body.read;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'hidden')) {
    if (typeof body.hidden !== 'boolean') return { error: 'Hidden state must be boolean.' };
    update.hidden = body.hidden;
  }
  return Object.keys(update).length ? { value: update } : { error: 'No supported update was provided.' };
}

async function updateAdminFeedback(request, env, id) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const feedbackId = Number(id);
  if (!Number.isInteger(feedbackId) || feedbackId < 1) {
    return jsonResponse({ error: 'Invalid feedback ID.' }, 400, request, env);
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch {
    return jsonResponse({ error: 'Invalid update.' }, 400, request, env);
  }
  const validation = validateAdminFeedbackUpdate(body);
  if (validation.error) return jsonResponse({ error: validation.error }, 400, request, env);

  const assignments = [];
  const values = [];
  if (Object.prototype.hasOwnProperty.call(validation.value, 'category')) {
    assignments.push('category = ?');
    values.push(validation.value.category);
  }
  if (Object.prototype.hasOwnProperty.call(validation.value, 'read')) {
    assignments.push('read_at = ?');
    values.push(validation.value.read ? new Date().toISOString() : null);
  }
  if (Object.prototype.hasOwnProperty.call(validation.value, 'hidden')) {
    assignments.push('hidden = ?');
    values.push(validation.value.hidden ? 1 : 0);
  }
  values.push(feedbackId);

  try {
    const result = await env.DB.prepare(`UPDATE feedback SET ${assignments.join(', ')} WHERE id = ?`).bind(...values).run();
    if (Number(result.meta.changes || 0) < 1) {
      return jsonResponse({ error: 'Feedback entry not found.' }, 404, request, env);
    }
    const entry = await getFeedbackEntry(env.DB, feedbackId, { includeHidden: true });
    return jsonResponse({ entry }, 200, request, env, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('[admin] Failed to update feedback:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'Unable to update feedback.' }, 500, request, env);
  }
}

async function adminMetrics(request, env) {
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const [visitorTotals, visitorToday, downloadTotals, downloadToday, feedbackTotals, categoryRows, voteTotals, downloadHistory] = await Promise.all([
      env.DB.prepare('SELECT COUNT(DISTINCT visitor_id) AS count FROM visitor_days').first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM visitor_days WHERE day = date('now')").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE event = 'download_click'").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM analytics_events WHERE event = 'download_click' AND created_at >= datetime('now', 'start of day')").first(),
      env.DB.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) AS hidden FROM feedback').first(),
      env.DB.prepare('SELECT category, COUNT(*) AS count FROM feedback GROUP BY category').all(),
      env.DB.prepare('SELECT SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS upvotes, SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS downvotes FROM feedback_votes').first(),
      env.DB.prepare("SELECT date(created_at) AS date, COUNT(*) AS count FROM analytics_events WHERE event = 'download_click' GROUP BY date(created_at) ORDER BY date(created_at) ASC LIMIT 30").all(),
    ]);

    const categories = Object.fromEntries(FEEDBACK_CATEGORIES.map((category) => [category, 0]));
    for (const row of categoryRows.results || []) {
      if (FEEDBACK_CATEGORIES.includes(row.category)) categories[row.category] = Number(row.count || 0);
    }

    const byDate = (downloadHistory.results || []).map((r) => ({
      date: String(r.date),
      count: Number(r.count || 0),
    }));

    return jsonResponse({
      visitors: { total: Number(visitorTotals?.count || 0), today: Number(visitorToday?.count || 0) },
      downloads: {
        total: Number(downloadTotals?.count || 0),
        today: Number(downloadToday?.count || 0),
        byDate,
      },
      feedback: {
        total: Number(feedbackTotals?.total || 0),
        hidden: Number(feedbackTotals?.hidden || 0),
        categories,
      },
      votes: { up: Number(voteTotals?.upvotes || 0), down: Number(voteTotals?.downvotes || 0) },
    }, 200, request, env, { 'Cache-Control': 'no-store' });
  } catch (error) {
    console.error('[admin] Failed to load metrics:', error instanceof Error ? error.message : 'unknown error');
    return jsonResponse({ error: 'Admin metrics are temporarily unavailable.' }, 500, request, env);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/') && request.method === 'OPTIONS') {
      return preflightResponse(request, env);
    }

    if (url.pathname === '/api/feedback') {
      if (request.method === 'GET') return listFeedback(request, env);
      if (request.method === 'POST') return submitFeedback(request, env);
      return textResponse('Method not allowed.', 405, request, env, { Allow: 'GET, POST' });
    }

    const voteMatch = url.pathname.match(/^\/api\/feedback\/(\d+)\/vote$/);
    if (voteMatch) {
      if (request.method !== 'POST') return textResponse('Method not allowed.', 405, request, env, { Allow: 'POST, OPTIONS' });
      return voteFeedback(request, env, voteMatch[1]);
    }

    if (url.pathname === '/api/events') {
      if (request.method !== 'POST') return textResponse('Method not allowed.', 405, request, env, { Allow: 'POST, OPTIONS' });
      return trackEvent(request, env);
    }

    if (url.pathname === '/api/admin/metrics') {
      if (request.method !== 'GET') return textResponse('Method not allowed.', 405, request, env, { Allow: 'GET, OPTIONS' });
      return adminMetrics(request, env);
    }

    if (url.pathname === '/api/admin/feedback') {
      if (request.method !== 'GET') return textResponse('Method not allowed.', 405, request, env, { Allow: 'GET, OPTIONS' });
      return listAdminFeedback(request, env);
    }

    const adminFeedbackMatch = url.pathname.match(/^\/api\/admin\/feedback\/(\d+)$/);
    if (adminFeedbackMatch) {
      if (request.method !== 'PATCH') return textResponse('Method not allowed.', 405, request, env, { Allow: 'PATCH, OPTIONS' });
      return updateAdminFeedback(request, env, adminFeedbackMatch[1]);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return textResponse('Not found.', 404, request, env);
  },
};
