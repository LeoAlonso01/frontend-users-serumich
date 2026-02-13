import { fail, redirect } from '@sveltejs/kit';

export const load = async (event) => {
  // proteger la página: solo usuarios autenticados
  if (!event.locals.user) {
    throw redirect(302, '/demo/better-auth/login');
  }

  // forward any search params from the page (so server-side render respects ?q=...)
  const res = await event.fetch(`/api/proxy/usuarios${event.url.search}`);
  const usuarios = res.ok ? await res.json() : [];

  // fetch unidades for the Create-user modal (prefetch first page)
  let ures = await event.fetch(`/api/proxy/unidades?limit=500`);
  let unidades = ures.ok ? await ures.json() : [];

  // fallback: external API returns [] for empty q — try a few broad queries server-side
  if (Array.isArray(unidades) && unidades.length === 0) {
    const fallbacks = ['a', 'e', 'o', 'i', 'u', 'r', 'c'];
    for (const q of fallbacks) {
      try {
        const tryRes = await event.fetch(`/api/proxy/unidades?q=${encodeURIComponent(q)}&limit=500`);
        if (!tryRes.ok) continue;
        const body = await tryRes.json();
        if (Array.isArray(body) && body.length > 0) {
          unidades = body;
          console.log('prefetch/unidades: fallback q="' + q + '" returned ' + body.length + ' items');
          break;
        }
      } catch (err) {
        console.warn('prefetch/unidades fallback error for q=' + q, err);
      }
    }
  }

  return { usuarios, unidades };
};

export const actions = {
  createUser: async (event) => {
    const form = await event.request.formData();
    const nombre = form.get('nombre')?.toString() ?? '';
    const email = form.get('email')?.toString() ?? '';
    const username = form.get('username')?.toString() ?? '';
    const unidad = Number(form.get('unidad') ?? 0);
    const es_titular = form.get('es_titular') === 'on';

    if (!nombre || !email || !username) {
      return fail(400, { message: 'nombre, email y username son requeridos' });
    }

    const payload = {
      empresa_id: 1,
      nombre,
      email,
      username,
      unidad_responsable_id: unidad || null,
      es_titular
    };

    const res = await event.fetch('/api/proxy/usuarios', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return fail(res.status, { message: err.message || 'Error creando usuario' });
    }

    // recargar la lista
    return redirect(302, '/demo/usuarios');
  }
};