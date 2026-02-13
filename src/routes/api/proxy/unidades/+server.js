import { json } from '@sveltejs/kit';

const API_BASE = 'http://localhost:8000/unidades';

export const GET = async (event) => {
  const isDev = process.env.NODE_ENV !== 'production';

  // allow unauthenticated access in development for debugging UX
  if (!event.locals.user && !isDev) return new Response(null, { status: 401 });

  console.log('proxy/unidades called', {
    hasUser: !!event.locals.user,
    isDev,
    search: event.url.search
  });

  try {
    const url = new URL(API_BASE);
    for (const [k, v] of event.url.searchParams) url.searchParams.append(k, v);

    const res = await fetch(url.toString(), { method: 'GET' });
    const body = await res.json();
    console.log('proxy/unidades -> fetched', { url: url.toString(), status: res.status, length: Array.isArray(body) ? body.length : null });
    return json(body, { status: res.status });
  } catch (err) {
    console.log('proxy/unidades -> error', { error: String(err) });
    return json({ error: 'proxy_error', message: String(err) }, { status: 502 });
  }
};