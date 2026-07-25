// Cloudflare Pages Function — /api/kv
// 프론트엔드(index.html)의 storageAdapter가 이 API를 호출합니다.
// Cloudflare 대시보드에서 이 Pages 프로젝트에 "STORE_KV"라는 이름으로
// KV 네임스페이스를 바인딩해야 정상 동작합니다. (배포_안내.md 참고)

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

// KV 오류(쓰기 한도 초과 등)를 HTML 오류페이지 대신 JSON으로 돌려줍니다
function kvError(e) {
  const msg = (e && e.message) ? e.message : String(e);
  let code = 'KV_ERROR';
  if (/429|rate limit|too many/i.test(msg)) code = 'KV_RATE_LIMIT';
  if (/limit exceeded|quota|daily/i.test(msg)) code = 'KV_QUOTA_EXCEEDED';
  return json({ error: code, message: msg }, 503);
}

// GET /api/kv?key=xxx        -> 특정 키 하나 조회
// GET /api/kv?prefix=xxx     -> 특정 접두사로 시작하는 키 목록 조회
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.STORE_KV) {
    return json({ error: 'KV_NOT_BOUND', message: 'STORE_KV 바인딩이 안 되어 있어요.' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  const prefix = url.searchParams.get('prefix');

  try {
    if (prefix !== null) {
      const list = await env.STORE_KV.list({ prefix });
      return json({ keys: list.keys.map(k => k.name) });
    }

    if (!key) return json({ error: 'KEY_REQUIRED' }, 400);

    const value = await env.STORE_KV.get(key);
    if (value === null) return json({ error: 'NOT_FOUND' }, 404);

    return json({ key, value });
  } catch (e) {
    return kvError(e);
  }
}

// POST /api/kv  body: { key, value }  -> 저장
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STORE_KV) {
    return json({ error: 'KV_NOT_BOUND', message: 'STORE_KV 바인딩이 안 되어 있어요.' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'INVALID_JSON' }, 400);
  }

  if (!body || !body.key) return json({ error: 'KEY_REQUIRED' }, 400);

  try {
    await env.STORE_KV.put(body.key, String(body.value == null ? '' : body.value));
    return json({ ok: true, key: body.key });
  } catch (e) {
    return kvError(e);
  }
}

// DELETE /api/kv?key=xxx -> 삭제
export async function onRequestDelete(context) {
  const { request, env } = context;

  if (!env.STORE_KV) {
    return json({ error: 'KV_NOT_BOUND' }, 500);
  }

  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'KEY_REQUIRED' }, 400);

  try {
    await env.STORE_KV.delete(key);
    return json({ ok: true });
  } catch (e) {
    return kvError(e);
  }
}
