import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const POST = async (event) => {
  try {
    await auth.api.signOut({ headers: event.request.headers });
  } catch (err) {
    // ignore errors — proceed to redirect
    console.warn('signOut error', err);
  }

  throw redirect(302, '/');
};