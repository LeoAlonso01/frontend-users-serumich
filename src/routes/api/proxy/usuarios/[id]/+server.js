import { json } from '@sveltejs/kit';

const API_BASE = 'http://localhost:8000/usuarios';

export const GET = async (event) => {
  if (!event.locals.user) return new Response(null, { status: 401 });
  const { id } = event.params;
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'GET' });
    const body = await res.json().catch(() => ({}));
    return json(body, { status: res.status });
  } catch (err) {
    return json({ error: 'proxy_error', message: String(err) }, { status: 502 });
  }
};

export const PUT = async (event) => {
  if (!event.locals.user) return new Response(null, { status: 401 });
  const { id } = event.params;
  try {
    const payload = await event.request.json();
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const body = await res.json().catch(() => ({}));
    return json(body, { status: res.status });
  } catch (err) {
    return json({ error: 'proxy_error', message: String(err) }, { status: 502 });
  }
};

export const DELETE = async (event) => {
  if (!event.locals.user) return new Response(null, { status: 401 });
  const { id } = event.params;
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    return json(body, { status: res.status });
  } catch (err) {
    return json({ error: 'proxy_error', message: String(err) }, { status: 502 });
  }
};