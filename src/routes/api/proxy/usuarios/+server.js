import { json } from '@sveltejs/kit';

// Proxy simple a la API externa (HTTP) — protegido: requiere session
const API_BASE = 'http://localhost:8000/usuarios'; // ajusta si tu API corre en otra URL

export const GET = async (event) => {
  if (!event.locals.user) {
    return new Response(null, { status: 401 });
  }

  try {
    // forward any query params (e.g. ?q=term, ?page=2)
    const url = new URL(API_BASE);
    for (const [k, v] of event.url.searchParams) url.searchParams.append(k, v);

    const res = await fetch(url.toString(), { method: 'GET' });
    const body = await res.json();
    return json(body, { status: res.status });
  } catch (err) {
    return json({ error: 'proxy_error', message: String(err) }, { status: 502 });
  }
};

export const POST = async (event) => {
  if (!event.locals.user) {
    return new Response(null, { status: 401 });
  }

  try {
    const payload = await event.request.json();

    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));
    return json(body, { status: res.status });
  } catch (err) {
    return json({ error: 'proxy_error', message: String(err) }, { status: 502 });
  }
};