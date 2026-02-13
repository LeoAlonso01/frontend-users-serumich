<script>
	import './layout.css';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';

	// use $props() (compatible con el runtime del proyecto)
	let { children, data } = $props();
	let navOpen = false;

	function toggleNav() {
		navOpen = !navOpen;
		console.debug('navOpen ->', navOpen);
	}

	onMount(() => {
		// close nav when clicking outside (defensive)
		const onDocClick = (e) => {
			const toggle = document.querySelector('.nav-toggle');
			const panel = document.querySelector('.nav-right');
			if (!panel || !toggle) return;
			if (navOpen && !panel.contains(e.target) && !toggle.contains(e.target)) {
				navOpen = false;
			}
		};
		document.addEventListener('click', onDocClick);
		return () => document.removeEventListener('click', onDocClick);
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header class="site-nav" data-open={navOpen} class:open={navOpen}>
  <div class="nav-inner">
    <div class="brand">
      <a href="/">UsersSERUMICH</a>
    </div>

    <button class="nav-toggle" aria-expanded={navOpen} on:click={toggleNav} aria-label="Abrir menú">{navOpen ? '✕' : '☰'}</button>

    <div class="nav-right" class:open={navOpen}>
      <nav class="links">
        <a href="/" on:click={() => (navOpen = false)}>Home</a>
        <a href="/demo/usuarios" on:click={() => (navOpen = false)}>Usuarios</a>
        <a href="/demo/better-auth" on:click={() => (navOpen = false)}>Auth demo</a>
      </nav>

      <div class="auth">
        {#if data?.user}
          <span class="who">{data.user.name ?? data.user.email}</span>
          <form method="post" action="/auth/signout">
            <button type="submit" class="btn-signout">Cerrar sesión</button>
          </form>
        {:else}
          <a class="login-link" href="/demo/better-auth/login">Iniciar sesión</a>
        {/if}
      </div>
    </div>
  </div>
</header>

{@render children()}

<style>
  .site-nav { background: #0f1724; color: #fff; padding: 0.5rem 1rem; box-shadow: 0 6px 18px rgba(2,6,23,0.08); }
  .nav-inner{ max-width:1200px; margin:0 auto; display:flex;align-items:center;gap:1rem; }
  .brand a{ color:#fff; font-weight:700; text-decoration:none; margin-right:12px }
  .nav-toggle{ display:none; background:transparent; border:1px solid rgba(255,255,255,0.06); color:#fff; padding:6px 8px; border-radius:8px; cursor:pointer }
  .nav-right{ display:flex; align-items:center; gap:12px; flex:1; justify-content:flex-end }
  .nav-right .links{ display:flex; gap:12px; }
  .links a{ color:rgba(255,255,255,0.9); text-decoration:none; padding:6px 8px; border-radius:6px }
  .links a:hover{ background: rgba(255,255,255,0.03) }
  .auth{ display:flex; gap:8px; align-items:center }
  .who{ color: #e6e9ee; font-weight:600; margin-right:6px }
  .btn-signout{ background:transparent; border:1px solid rgba(255,255,255,0.12); color:#fff; padding:6px 8px; border-radius:8px; cursor:pointer }
  .login-link{ color:#93c5fd; text-decoration:none; padding:6px 8px; border-radius:6px; border:1px solid transparent }

  /* responsive: mobile */
  @media (max-width: 720px) {
    .nav-inner{ flex-direction:row; gap:0.5rem }
    .nav-toggle{ display:block; z-index:80 }
    .nav-right{ position:fixed; inset:56px 12px auto 12px; background: #0b1220; border-radius:10px; padding:12px; box-shadow: 0 12px 40px rgba(2,6,23,0.5); flex-direction:column; align-items:flex-start; gap:12px; display:none; z-index:70 }
    /* use header[data-open] and header.open as fallback for reliable toggle */
    header.site-nav[data-open="true"] .nav-right{ display:flex }
    header.site-nav.open .nav-right { display:flex }
    .nav-right .links{ flex-direction:column; width:100% }
    .nav-right .links a{ display:block; padding:10px 12px; width:100% }
    .nav-right .auth{ width:100%; justify-content:space-between }
  }
</style>
