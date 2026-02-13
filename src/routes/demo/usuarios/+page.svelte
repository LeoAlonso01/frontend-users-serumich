<script>
	export let data;

	// list (mutable so client search can update it)
	let usuarios = data?.usuarios ?? [];

	// search
	let search = '';
	let searchTimer;

	// page & page-size
	let currentPage = 1;
	const PAGE_SIZE = 50;

	// initialize search & page from URL (server-rendered params)
	if (typeof window !== 'undefined') {
		const params = new URLSearchParams(location.search);
		search = params.get('q') ?? '';
		currentPage = Number(params.get('page') ?? 1);
	}

	async function doSearch(q, page = 1) {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(async () => {
			try {
				const qs = new URLSearchParams();
				if (q) qs.set('q', q);
				qs.set('page', String(page));
				qs.set('limit', String(PAGE_SIZE));

				const res = await fetch('/api/proxy/usuarios' + (qs.toString() ? `?${qs.toString()}` : ''));
				if (res.ok) {
					usuarios = await res.json();
					currentPage = page;
					const newUrl =
						(q ? `?q=${encodeURIComponent(q)}` : '') +
						(page > 1 ? `${q ? '&' : '?'}page=${page}` : '');
					history.replaceState(null, '', newUrl || location.pathname);
				}
			} catch (err) {
				console.error('search error', err);
			}
		}, 300);
	}

	function changePage(next) {
		if (next < 1) return;
		currentPage = next;
		doSearch(search, currentPage);
	}

	// modal state (create)
	let showModal = false;
	async function openModal() {
		showModal = true;
		await tick();
		positionModalForInput();
	}

	const closeModal = () => {
		showModal = false;
		serverError = null;
		modalOffsetY = 0;
	};

	const onKeydown = (e) => {
		if (e.key === 'Escape') {
			closeModal();
			closeEdit();
			closeDetails();
		}
	};

	// form helpers (client-side submit + error display)
	let submitting = false;
	let serverError = null;
	let nombreInput, usernameInput, emailInput, titularInput, unidadInputEl;

  // unidades (prefetched from server). if empty, fetch client-side as fallback
  import { onMount, tick } from 'svelte';
  let unidades = data?.unidades ?? [];
  let unidadesError = null;

  // typeahead state for Crear usuario
  let unidadQuery = '';
  let unidadValue = ''; // selected unidad id
  let unidadSuggestions = [];
  let suggestionsLoading = false;
  let suggestionsError = null;
  let suggestionsTimer;
  let activeSuggestionIndex = -1; // -1 = none focused
  let dropUp = false; // when true, render suggestions above the input
  let modalEl;
  let modalOffsetY = 0; // px offset to shift modal (negative moves up)

  // --- Edit-modal typeahead state (separate from Crear) ---
  let editUnidadQuery = '';
  let editUnidadValue = null; // selected unidad id (number)
  let editUnidadSuggestions = [];
  let editSuggestionsLoading = false;
  let editSuggestionsError = null;
  let editSuggestionsTimer;
  let editActiveSuggestionIndex = -1;
  let editDropUp = false;
  let editUnidadInputEl;
  let editModalEl;
  let editModalOffsetY = 0;
  $: displayEditUnidadInput = editActiveSuggestionIndex >= 0 && editUnidadSuggestions[editActiveSuggestionIndex]
    ? unidadLabel(editUnidadSuggestions[editActiveSuggestionIndex])
    : editUnidadQuery;

  async function loadUnidadesClient() {
    unidadesError = null;
    try {
      const res = await fetch('/api/proxy/unidades?limit=500');
      if (!res.ok) {
        unidadesError = `HTTP ${res.status}`;
        return;
      }
      let body = await res.json();

      // fallback: try a few broad queries if the API returns [] for empty q
      if (Array.isArray(body) && body.length === 0) {
        const fallbacks = ['a', 'e', 'o', 'i', 'u', 'r', 'c'];
        for (const q of fallbacks) {
          try {
            const r2 = await fetch(`/api/proxy/unidades?q=${encodeURIComponent(q)}&limit=500`);
            if (!r2.ok) continue;
            const b2 = await r2.json();
            if (Array.isArray(b2) && b2.length > 0) {
              body = b2;
              break;
            }
          } catch (err) {
            console.warn('loadUnidadesClient fallback error for q=' + q, err);
          }
        }
      }

      unidades = body;
    } catch (err) {
      unidadesError = String(err);
      console.error('failed to load unidades client-side', err);
    }
  }

  // --- Edit-modal helpers: suggestions, keyboard navigation, positioning ---
  async function fetchEditUnidadSuggestions(q) {
    clearTimeout(editSuggestionsTimer);
    editSuggestionsError = null;
    editUnidadSuggestions = [];
    if (!q || q.length === 0) return;

    editSuggestionsLoading = true;
    editSuggestionsTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/proxy/unidades?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) {
          editSuggestionsError = `HTTP ${res.status}`;
          editSuggestionsLoading = false;
          return;
        }
        editUnidadSuggestions = await res.json();
        editActiveSuggestionIndex = -1;

        // merge into global unidades so edit-select shows them
        if (Array.isArray(editUnidadSuggestions) && editUnidadSuggestions.length > 0) {
          const existing = new Map(unidades.map((u) => [String(u.id), u]));
          for (const s of editUnidadSuggestions) {
            if (!existing.has(String(s.id))) existing.set(String(s.id), s);
          }
          unidades = Array.from(existing.values());
          updateEditSuggestionsPosition();
        }
      } catch (err) {
        editSuggestionsError = String(err);
        console.error('fetchEditUnidadSuggestions error', err);
      } finally {
        editSuggestionsLoading = false;
      }
    }, 250);
  }

  function setActiveEdit(idx) {
    editActiveSuggestionIndex = idx;
    const el = document.getElementById(`edit-unidad-suggestion-${idx}`);
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }

  function moveActiveEdit(delta) {
    if (!editUnidadSuggestions || editUnidadSuggestions.length === 0) return;
    let next = editActiveSuggestionIndex + delta;
    if (editActiveSuggestionIndex === -1 && delta > 0) next = 0;
    if (next < 0) next = 0;
    if (next >= editUnidadSuggestions.length) next = editUnidadSuggestions.length - 1;
    editActiveSuggestionIndex = next;
    const el = document.getElementById(`edit-unidad-suggestion-${next}`);
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }

  function selectEditUnidad(un) {
    editUnidadValue = un?.id ?? null;
    editUnidadQuery = un?.razon_social || un?.tag || String(un?.id || '');
    editUnidadSuggestions = [];
    editActiveSuggestionIndex = -1;
    editDropUp = false;
    if (editUser) editUser.unidad_responsable_id = un?.id ?? null;
  }

  function selectActiveEdit() {
    if (editActiveSuggestionIndex >= 0 && editUnidadSuggestions[editActiveSuggestionIndex]) {
      selectEditUnidad(editUnidadSuggestions[editActiveSuggestionIndex]);
    }
  }

  function updateEditSuggestionsPosition() {
    try {
      if (!editUnidadInputEl || !editUnidadSuggestions || editUnidadSuggestions.length === 0) {
        editDropUp = false;
        return;
      }
      const rect = editUnidadInputEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const estimated = Math.min(400, Math.max(120, editUnidadSuggestions.length * 40));
      if (spaceBelow < Math.min(estimated, 220) && spaceAbove > spaceBelow) {
        editDropUp = true;
      } else {
        editDropUp = false;
      }
    } catch (err) {
      editDropUp = false;
    }
  }

  function positionEditModalForInput() {
    try {
      if (!showEditModal || !editUnidadInputEl || !editModalEl) {
        editModalOffsetY = 0;
        return;
      }
      const inputRect = editUnidadInputEl.getBoundingClientRect();
      const modalRect = editModalEl.getBoundingClientRect();
      const desiredDropdown = Math.min(400, Math.max(120, editUnidadSuggestions.length * 40));
      const margin = 16;
      const availableBelow = window.innerHeight - inputRect.bottom - margin;
      if (availableBelow >= Math.min(desiredDropdown, 220)) {
        editModalOffsetY = 0;
        return;
      }
      const targetInputBottom = window.innerHeight - (Math.min(desiredDropdown, 220) + margin);
      const delta = targetInputBottom - inputRect.bottom;
      const maxUp = - (modalRect.top - 12);
      editModalOffsetY = Math.max(delta, maxUp);
    } catch (err) {
      editModalOffsetY = 0;
    }
  }

  async function fetchUnidadSuggestions(q) {
    clearTimeout(suggestionsTimer);
    suggestionsError = null;
    unidadSuggestions = [];
    if (!q || q.length === 0) return;

    suggestionsLoading = true;
    suggestionsTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/proxy/unidades?q=${encodeURIComponent(q)}&limit=20`);
        if (!res.ok) {
          suggestionsError = `HTTP ${res.status}`;
          suggestionsLoading = false;
          return;
        }
        unidadSuggestions = await res.json();
        activeSuggestionIndex = -1;

        // merge received suggestions into `unidades` so they are listed/seleccionables
        if (Array.isArray(unidadSuggestions) && unidadSuggestions.length > 0) {
          const existing = new Map(unidades.map((u) => [String(u.id), u]));
          for (const s of unidadSuggestions) {
            if (!existing.has(String(s.id))) existing.set(String(s.id), s);
          }
          unidades = Array.from(existing.values());
          // determine whether to render the dropdown above/below the input
          updateSuggestionsPosition();
          // reposition modal so the input has room for dropdown (if needed)
          positionModalForInput();
        }

        console.log('unidadSuggestions fetched', { q, status: res.status, length: unidadSuggestions.length, sample: unidadSuggestions.slice(0,5) });
      } catch (err) {
        suggestionsError = String(err);
        console.error('fetchUnidadSuggestions error', err);
      } finally {
        suggestionsLoading = false;
      }
    }, 250);
  }

  function selectUnidad(un) {
    unidadValue = un?.id ?? '';
    unidadQuery = un?.razon_social || un?.tag || String(un?.id || '');
    unidadSuggestions = [];
    activeSuggestionIndex = -1;
    dropUp = false;
  }

  function setActive(idx) {
    activeSuggestionIndex = idx;
    const el = document.getElementById(`unidad-suggestion-${idx}`);
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'nearest' });
  }

  function moveActive(delta) {
    if (!unidadSuggestions || unidadSuggestions.length === 0) return;
    let next = activeSuggestionIndex + delta;
    if (activeSuggestionIndex === -1 && delta > 0) next = 0;
    if (next < 0) next = 0;
    if (next >= unidadSuggestions.length) next = unidadSuggestions.length - 1;
    activeSuggestionIndex = next;
    // keep focus on the input (so further keyboard events are handled there),
    // but ensure the active item is scrolled into view and visually marked
    const el = document.querySelector(`.suggestions li:nth-child(${next + 1})`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function selectActive() {
    if (activeSuggestionIndex >= 0 && unidadSuggestions[activeSuggestionIndex]) {
      selectUnidad(unidadSuggestions[activeSuggestionIndex]);
    }
  }

  // show preview in input while navigating with arrows (does not commit selection)
  $: displayUnidadInput = activeSuggestionIndex >= 0 && unidadSuggestions[activeSuggestionIndex]
    ? unidadLabel(unidadSuggestions[activeSuggestionIndex])
    : unidadQuery;

  // measure space and flip dropdown above input when there's not enough room below
  function updateSuggestionsPosition() {
    try {
      if (!unidadInputEl || !unidadSuggestions || unidadSuggestions.length === 0) {
        dropUp = false;
        return;
      }
      const rect = unidadInputEl.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // estimate dropdown height (min / max). 40px per item approx, clamp.
      const estimated = Math.min(400, Math.max(120, unidadSuggestions.length * 40));
      // prefer below unless not enough space and more space above
      if (spaceBelow < Math.min(estimated, 220) && spaceAbove > spaceBelow) {
        dropUp = true;
      } else {
        dropUp = false;
      }
    } catch (err) {
      dropUp = false;
    }
  }

  // position the modal so the input has room for the dropdown (move modal up if needed)
  function positionModalForInput() {
    try {
      if (!showModal || !unidadInputEl || !modalEl) {
        modalOffsetY = 0;
        return;
      }

      const inputRect = unidadInputEl.getBoundingClientRect();
      const modalRect = modalEl.getBoundingClientRect();

      // estimate desired space below input for dropdown
      const desiredDropdown = Math.min(400, Math.max(120, unidadSuggestions.length * 40));
      const margin = 16; // keep some breathing room
      const availableBelow = window.innerHeight - inputRect.bottom - margin;

      if (availableBelow >= Math.min(desiredDropdown, 220)) {
        // enough space below; reset offset
        modalOffsetY = 0;
        return;
      }

      // compute how much to move modal upwards so input's bottom gains spaceBelow = desiredDropdown + margin
      const targetInputBottom = window.innerHeight - (Math.min(desiredDropdown, 220) + margin);
      const delta = targetInputBottom - inputRect.bottom;

      // delta will be negative if we need to move modal up; clamp so modal doesn't go off-screen
      const maxUp = - (modalRect.top - 12); // don't move modal past 12px from top
      modalOffsetY = Math.max(delta, maxUp);
    } catch (err) {
      modalOffsetY = 0;
    }
  }

  onMount(async () => {
    if (!unidades || unidades.length === 0) {
      await loadUnidadesClient();
    }

    const resizeHandler = () => {
      updateSuggestionsPosition();
      if (showModal) positionModalForInput();
      if (showEditModal) positionEditModalForInput();
    };
    window.addEventListener('resize', resizeHandler);
    // listen on capture so scrolling inside modal/container is also detected
    window.addEventListener('scroll', resizeHandler, true);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('scroll', resizeHandler, true);
    };
  });

	async function handleSubmit(e) {
		e?.preventDefault?.();
		serverError = null;
		submitting = true;

		const payload = {
			empresa_id: 1,
			nombre: nombreInput.value.trim(),
			username: usernameInput.value.trim(),
			email: emailInput.value.trim(),
			unidad_responsable_id: unidadValue ? Number(unidadValue) : null,
			es_titular: titularInput.checked
		};

		// client validation
		if (!payload.nombre || !payload.username || !payload.email) {
			serverError = 'Nombre, username y email son requeridos.';
			submitting = false;
			return;
		}

		try {
			const res = await fetch('/api/proxy/usuarios', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const body = await res.json().catch(() => ({}));

			if (!res.ok) {
				serverError = body.message || 'Error al crear usuario';
				submitting = false;
				return;
			}

			closeModal();
			await doSearch(search); // refresh list using current filter
		} catch (err) {
			serverError = String(err);
			submitting = false;
		} finally {
			submitting = false;
		}
	}

	// === Edit / Details modals & actions ===
	let editUser = null; // object being edited
	let showEditModal = false;
	async function openEdit(u) {
		editUser = { ...u };
		// populate edit-unidad input from the user's unidad_responsable_id
		editUnidadValue = editUser.unidad_responsable_id ?? null;
		editUnidadQuery = findUnidadLabelById(editUnidadValue) || '';
		editUnidadSuggestions = [];
		editActiveSuggestionIndex = -1;
		showEditModal = true;
		await tick();
		positionEditModalForInput();
	}
	function closeEdit() {
		showEditModal = false;
		editUser = null;
		editModalOffsetY = 0;
	}

	async function submitEdit() {
		if (!editUser) return;
		try {
			const res = await fetch(`/api/proxy/usuarios/${editUser.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(editUser)
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				alert(body.message || 'Error actualizando');
				return;
			}
			closeEdit();
			await doSearch(search);
		} catch (err) {
			alert(String(err));
		}
	}

	let detailsUser = null;
	let showDetailsModal = false;
	function openDetails(u) {
		detailsUser = u;
		showDetailsModal = true;
	}
	function closeDetails() {
		showDetailsModal = false;
		detailsUser = null;
	}

	// helper: escape + highlight
	function escapeHtml(str = '') {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
	function escapeRegExp(s) {
		return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
	function highlight(text, term) {
		if (!term) return escapeHtml(text);
		const re = new RegExp(escapeRegExp(term), 'gi');
		return escapeHtml(text).replace(re, (m) => `<mark>${m}</mark>`);
	}

  // unidad label helpers
  function unidadLabel(u) {
    if (!u) return '';
    const parts = [];
    if (u.id != null) parts.push(u.id);
    // prefer tag, otherwise razon_social
    parts.push(u.tag ?? u.razon_social ?? '');
    if (u.cve_ure) parts.push(u.cve_ure);
    if (u.razon_social && u.razon_social !== (u.tag ?? '')) parts.push(u.razon_social);
    return parts.filter(Boolean).join(' — ');
  }

  function findUnidadLabelById(id) {
    if (!id) return '';
    const u = unidades.find((x) => String(x.id) === String(id));
    return u ? unidadLabel(u) : String(id);
  }
</script>

<section class="usuarios-page">
	<header class="page-header">
		<div style="min-width:240px">
			<h1>Usuarios</h1>
			<p class="muted">Mostrando {usuarios.length} usuarios</p>
			<a class="back-link" href="/demo/better-auth">Volver</a>

			<div style="margin-top:8px; display:flex; gap:8px; align-items:center">
				<input
					class="search-input"
					placeholder="Buscar usuarios (nombre, username, email)..."
					bind:value={search}
					on:input={() => doSearch(search)}
				/>
				{#if search}
					<button
						class="btn"
						on:click={() => {
							search = '';
							doSearch('');
						}}>Limpiar</button
					>
				{/if}
			</div>
		</div>

		<button class="btn btn-primary" on:click={openModal}>+ Crear usuario</button>
	</header>

	{#if showModal}
		<div
			class="modal-backdrop"
			on:click={closeModal}
			on:keydown={onKeydown}
			tabindex="0"
			role="dialog"
			aria-modal="true"
		>
			<div class="modal" bind:this={modalEl} on:click|stopPropagation style="transform: translateY({modalOffsetY}px)">
				<header class="modal-header">
					<h2>Crear usuario</h2>
					<button aria-label="Cerrar" class="close-btn" on:click={closeModal}>✕</button>
				</header>

				<form on:submit|preventDefault={handleSubmit} class="form-grid">
					<label>
						<span>Nombre completo</span>
						<input bind:this={nombreInput} name="nombre" placeholder="Nombre completo" required />
					</label>

					<label>
						<span>Username</span>
						<input bind:this={usernameInput} name="username" placeholder="username" required />
					</label>

					<label>
						<span>Email</span>
						<input
							bind:this={emailInput}
							name="email"
							type="email"
							placeholder="email@ejemplo.com"
							required
						/>
					</label>

					<label>
						<span>Unidad responsable</span>
					<input
					bind:this={unidadInputEl}
				type="text"
				placeholder="Escribe para buscar unidad (mín. 1 letra)" role="combobox" aria-autocomplete="list" aria-expanded={unidadSuggestions.length > 0} aria-controls="unidad-suggestions-list" aria-activedescendant={activeSuggestionIndex >= 0 && unidadSuggestions[activeSuggestionIndex] ? `unidad-suggestion-${activeSuggestionIndex}` : undefined}
				value={displayUnidadInput}
				on:focus={() => { updateSuggestionsPosition(); positionModalForInput(); }}
				on:input={(e) => {
					// user-typed value overrides preview
					unidadValue = '';
					unidadQuery = /** @type {HTMLInputElement} */ (e.currentTarget).value;
					fetchUnidadSuggestions(unidadQuery);
					activeSuggestionIndex = -1;
				}}
				on:keydown={(e) => {
					if (e.key === 'ArrowDown') {
						if (unidadSuggestions.length > 0) { e.preventDefault(); moveActive(1); }
					} else if (e.key === 'ArrowUp') {
						if (unidadSuggestions.length > 0) { e.preventDefault(); moveActive(-1); }
					} else if (e.key === 'Enter') {
						if (activeSuggestionIndex >= 0) { e.preventDefault(); selectActive(); }
					} else if (e.key === 'Escape') {
						unidadSuggestions = [];
						activeSuggestionIndex = -1;
						dropUp = false;
					}
				}}
				autocomplete="off"
			/>
				<input type="hidden" name="unidad" value={unidadValue} />
					{#if suggestionsLoading}
						<div class="suggestions small">Buscando...</div>
					{:else if unidadSuggestions.length > 0}
						<ul id="unidad-suggestions-list" class="suggestions" class:up={dropUp} role="listbox">
						{#each unidadSuggestions as s, i}
							<li
								tabindex="-1"
								id={`unidad-suggestion-${i}`} role="option"
								aria-selected={activeSuggestionIndex === i}
								class:active={activeSuggestionIndex === i}
								on:click={() => selectUnidad(s)}
								on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectUnidad(s); } }}
								on:mouseenter={() => setActive(i)}
							>{unidadLabel(s)}</li>
							{/each}
						</ul>
					{/if}
							
                <label class="checkbox-field">
						<input bind:this={titularInput} name="es_titular" type="checkbox" checked />
						<span>Titular</span>
					</label>

					<div class="actions">
						<button class="btn" type="button" on:click={closeModal}>Cancelar</button>
						<button class="btn btn-primary" name="createUser" type="submit" disabled={submitting}
							>{submitting ? 'Enviando...' : 'Crear'}</button
						>
					</div>

					{#if serverError}
						<div style="grid-column:1/-1;color:#b91c1c">{serverError}</div>
					{/if}
				</form>
			</div>
		</div>
	{/if}

	{#if showEditModal}
		<div class="modal-backdrop" on:click={closeEdit} tabindex="0">
				<div class="modal" bind:this={editModalEl} on:click|stopPropagation style="transform: translateY({editModalOffsetY}px)">
					<header class="modal-header">
						<h2>Editar usuario</h2>
						<button aria-label="Cerrar" class="close-btn" on:click={closeEdit}>✕</button>
					</header>

					{#if editUser}
						<div class="form-grid">
							<label>
								<span>Nombre</span>
								<input bind:value={editUser.nombre} />
							</label>
							<label>
								<span>Username</span>
								<input bind:value={editUser.username} />
							</label>
							<label>
								<span>Email</span>
								<input bind:value={editUser.email} type="email" />
							</label>

							<label>
								<span>Unidad</span>
								<input
									bind:this={editUnidadInputEl}
									type="text"
									placeholder="Escribe para buscar unidad (mín. 1 letra)"
									value={displayEditUnidadInput}
									on:focus={() => { updateEditSuggestionsPosition(); positionEditModalForInput(); }}
									on:input={(e) => {
										editUnidadValue = null;
										editUnidadQuery = /** @type {HTMLInputElement} */(e.currentTarget).value;
										fetchEditUnidadSuggestions(editUnidadQuery);
										editActiveSuggestionIndex = -1;
									}}
									on:keydown={(e) => {
										if (e.key === 'ArrowDown') { if (editUnidadSuggestions.length > 0) { e.preventDefault(); moveActiveEdit(1); } }
										else if (e.key === 'ArrowUp') { if (editUnidadSuggestions.length > 0) { e.preventDefault(); moveActiveEdit(-1); } }
										else if (e.key === 'Enter') { if (editActiveSuggestionIndex >= 0) { e.preventDefault(); selectActiveEdit(); } }
										else if (e.key === 'Escape') { editUnidadSuggestions = []; editActiveSuggestionIndex = -1; editDropUp = false; }
										}}
										autocomplete="off"
									/>
									<input type="hidden" name="edit_unidad" value={editUnidadValue} />
									{#if editSuggestionsLoading}
										<div class="suggestions small">Buscando...</div>
									{:else if editUnidadSuggestions.length > 0}
										<ul id="edit-unidad-suggestions-list" class="suggestions" class:up={editDropUp} role="listbox">
										{#each editUnidadSuggestions as s, j}
											<li id={`edit-unidad-suggestion-${j}`} tabindex="-1" role="option" aria-selected={editActiveSuggestionIndex === j} class:active={editActiveSuggestionIndex === j} on:click={() => selectEditUnidad(s)} on:mouseenter={() => setActiveEdit(j)}>{unidadLabel(s)}</li>
										{/each}
										</ul>
									{/if}
								</label>

								<label class="checkbox-field">
									<input type="checkbox" bind:checked={editUser.es_titular} />
									<span>Titular</span>
								</label>
								<div class="actions">
									<button class="btn" on:click={closeEdit} type="button">Cancelar</button>
									<button class="btn btn-primary" on:click={submitEdit} type="button">Guardar</button>
								</div>
							</div>
					{/if}
				</div>
			</div>
		{/if}
		{#if showDetailsModal}
			<div class="modal-backdrop" on:click={closeDetails} tabindex="0">
			<div class="modal" on:click|stopPropagation>
				<header class="modal-header">
					<h2>Detalles</h2>
					<button aria-label="Cerrar" class="close-btn" on:click={closeDetails}>✕</button>
				</header>
				{#if detailsUser}
					<pre
						style="white-space:pre-wrap; background:#f8fafc; padding:12px; border-radius:8px;">{JSON.stringify(
							detailsUser,
							null,
							2
						)}</pre>
					<div style="display:flex;justify-content:flex-end;margin-top:12px">
						<button class="btn" on:click={closeDetails}>Cerrar</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	{#if usuarios.length === 0}
		<div class="empty-state">
			<p>No hay usuarios (o error al obtener).</p>
		</div>
	{:else}
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>ID</th>
						<th>Nombre</th>
						<th>Username</th>
						<th>Email</th>
						<th>Unidad</th>
						<th>Titular</th>
						<th style="width:180px">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{#each usuarios as u}
						<tr>
							<td>{u.id}</td>
							<td>{@html highlight(u.nombre, search)}</td>
							<td>{@html highlight(u.username, search)}</td>
							{#if u.email}
								<td>{@html highlight(u.email, search)}</td>
							{:else}
								<td><em>Sin email</em></td>
							{/if}
							<td>{findUnidadLabelById(u.unidad_responsable_id)}</td>
							<td>
								<span class={`badge ${u.es_titular ? 'yes' : 'no'}`}>
									{u.es_titular ? 'Sí' : 'No'}
								</span>
							</td>
							<td>
								<div style="display:flex;gap:8px">
									<button class="btn" on:click={() => openDetails(u)}>Detalles</button>
									<button class="btn" on:click={() => openEdit(u)}>Editar</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- pagination controls -->
			<div
				style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-top:1px solid var(--border)"
			>
				<div class="muted">Mostrando {usuarios.length} items</div>
				<div style="display:flex;gap:8px;align-items:center">
					<button
						class="btn"
						on:click={() => changePage(currentPage - 1)}
						disabled={currentPage === 1}>Anterior</button
					>
					<span>Página {currentPage}</span>
					<button
						class="btn"
						on:click={() => changePage(currentPage + 1)}
						disabled={usuarios.length < PAGE_SIZE}>Siguiente</button
					>
				</div>
			</div>
		</div>
	{/if}

	<!-- quick signout button on users page (same action as navbar) -->
	<form method="post" action="/auth/signout" style="margin-top:12px">
		<button class="btn" type="submit">Cerrar sesión</button>
	</form>
</section>

<style>
	:global(:root) {
		--bg: #f4f6f8;
		--surface: #ffffff;
		--text: #1f2937;
		--muted: #6b7280;
		--border: #e5e7eb;
		--primary: #0f172a;
		--primary-hover: #1e293b;
	}

	.usuarios-page {
		padding: 2rem;
		background: var(--bg);
		min-height: 100vh;
		color: var(--text);
		display: grid;
		gap: 1.5rem;
	}

	.page-header {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1,
	h2 {
		margin: 0;
		font-weight: 600;
	}

	.muted {
		margin-top: 0.25rem;
		color: var(--muted);
		font-size: 0.9rem;
	}

	/* Buttons */

	.btn {
		border: 1px solid var(--border);
		background: #fff;
		border-radius: 6px;
		padding: 0.55rem 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn:hover {
		background: #f3f4f6;
	}

	.btn-primary {
		background: var(--primary);
		color: #fff;
		border: none;
	}

	.btn-primary:hover {
		background: var(--primary-hover);
	}

	/* Search */

	.search-input {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		width: 320px;
		background: #fff;
	}

	.search-input:focus {
		outline: none;
		border-color: #cbd5e1;
	}

	/* Table */

	.table-wrap {
		overflow: auto;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 760px;
	}

	th,
	td {
		text-align: left;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--border);
		font-size: 0.95rem;
	}

	thead th {
		font-size: 0.8rem;
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		background: #f9fafb;
	}

	tbody tr:hover {
		background: #f8fafc;
	}

	/* Badge */

	.badge {
		display: inline-block;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.25rem 0.55rem;
		border-radius: 4px;
	}

	.badge.yes {
		background: #e6f4ea;
		color: #166534;
	}

	.badge.no {
		background: #f3f4f6;
		color: #374151;
	}

	/* Empty state */

	.empty-state {
		padding: 2rem;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--muted);
	}

	/* Modal */

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		z-index: 60;
	}

	.modal {
		width: min(760px, 100%);
		border-radius: 8px;
		background: var(--surface);
		border: 1px solid var(--border);
		padding: 1.5rem;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.close-btn {
		background: transparent;
		border: none;
		font-size: 1rem;
		color: var(--muted);
		cursor: pointer;
	}

	/* Forms */

	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	label {
		position: relative; /* anchor absolute suggestions dropdown to this label */
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: var(--muted);
	}

	input {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 0.55rem 0.7rem;
		font: inherit;
		background: #fff;
		color: var(--text);
	}

	input:focus {
		outline: none;
		border-color: #cbd5e1;
	}

	.checkbox-field {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text);
	}

	.actions {
		grid-column: 1 / -1;
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	mark {
		background: #fff3cd;
		padding: 0 0.2rem;
		border-radius: 3px;
	}

	/* === Botones por tipo de acción === */

	.btn-neutral {
		background: #f3f4f6;
		border: 1px solid var(--border);
		color: #374151;
	}

	.btn-neutral:hover {
		background: #e5e7eb;
	}

	.btn-edit {
		background: #e5e7eb;
		border: 1px solid #d1d5db;
		color: #1f2937;
	}

	.btn-edit:hover {
		background: #d1d5db;
	}

	.btn-danger {
		background: #f5f5f5;
		border: 1px solid #e5e7eb;
		color: #7f1d1d;
	}

	.btn-danger:hover {
		background: #fee2e2;
	}

	@media (max-width: 720px) {
		.usuarios-page {
			padding: 1rem;
		}

		.form-grid {
			grid-template-columns: 1fr;
		}
	}

	/* suggestions (typeahead) */
	.suggestions {
		position: absolute;
		top: calc(30% + 6px);
		left: 0;
		/* fill the label/input width and use border-box so padding doesn't change size */
		width: 100%;
		box-sizing: border-box;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		max-height: 40vh; /* keep it visible inside modal */
		overflow-y: auto;
		z-index: 9999; /* ensure dropdown appears above modal/nav */
		padding: 0.25rem 0;
		list-style: none;
		box-shadow: 0 10px 30px rgba(2,6,23,0.12);
	}

	.suggestions.small { padding: 6px 10px; color: var(--muted); font-size: 0.9rem }

	.suggestions li { padding: 8px 10px; cursor: pointer; border-bottom: 1px solid var(--border); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 120ms ease, color 120ms ease; }
	.suggestions li:hover { background: #f8fafc }
	.suggestions li:focus { background:#e6f0ff; outline: none; }
	.suggestions li.active { background:#e6f0ff; color: var(--primary); font-weight: 600; box-shadow: inset 3px 0 0 var(--primary); }

	/* flipped (drop-up) positioning */
	.suggestions.up { top: auto; bottom: calc(100% + 6px); box-shadow: 0 -6px 20px rgba(2,6,23,0.08); }
	.suggestions.up li { border-bottom: 1px solid var(--border); }

	/* ensure label/input occupy full column so dropdown aligns */
	.form-grid label { width: 100%; }

	/* allow dropdown to extend outside modal if necessary */
	.modal { overflow: visible; }
</style>
