export async function onRequest(context) {
  const { request, env } = context;

  // KV binding must be configured in Cloudflare Pages:
  //   Variable name: VISITS_KV
  //   Type: KV Namespace
  if (!env || !env.VISITS_KV) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'VISITS_KV is not configured',
      }),
      {
        status: 501,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        },
      }
    );
  }

  const url = new URL(request.url);
  const visitorId = (url.searchParams.get('id') || '').trim();

  if (!visitorId || visitorId.length > 120) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid id' }), {
      status: 400,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const visitorKey = `v:${visitorId}`;
  const totalKey = 'total_users';

  // "Unique" visitors based on client-generated id.
  // Note: KV doesn't provide atomic increments; this is best-effort.
  const alreadySeen = await env.VISITS_KV.get(visitorKey);

  let total = 0;
  const totalRaw = await env.VISITS_KV.get(totalKey);
  if (totalRaw && /^\d+$/.test(totalRaw)) total = Number(totalRaw);

  if (!alreadySeen) {
    await env.VISITS_KV.put(visitorKey, '1', {
      expirationTtl: 60 * 60 * 24 * 365, // 365 days
    });

    total += 1;
    await env.VISITS_KV.put(totalKey, String(total));
  }

  return new Response(JSON.stringify({ ok: true, totalUsers: total }), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
