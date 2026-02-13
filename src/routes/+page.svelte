<script>
  // No lógica compleja aquí, es una landing institucional
</script>

<section class="home">
  <div class="container">
    <h1>Bienvenido a UsersSERUMICH</h1>

    <p class="subtitle">
      Plataforma institucional para la administración de usuarios.
    </p>

    <div class="card">
      <h2>Gestión centralizada</h2>
      <p>
        Desde este sistema puedes crear, editar y administrar usuarios
        de manera segura y controlada.
      </p>

      <ul>
        <li>✔ Crear nuevos usuarios</li>
        <li>✔ Editar información existente</li>
        <li>✔ Administrar credenciales</li>
        <li>✔ Control de acceso y autenticación</li>
      </ul>

      <div class="actions">
        <a href="/demo/usuarios" class="btn-primary">Ir a Usuarios</a>
      </div>
    </div>
  </div>
</section>

<style>
  .home {
    min-height: calc(100vh - 70px);
    background: #f4f6f8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .container {
    width: 100%;
    max-width: 900px;
    padding: 2rem;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: #1f2937;
    font-weight: 600;
  }

  .subtitle {
    margin-bottom: 2rem;
    color: #4b5563;
  }

  .card {
    background: #ffffff;
    border-radius: 8px;
    padding: 2rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid #e5e7eb;
  }

  h2 {
    margin-bottom: 1rem;
    font-size: 1.25rem;
    color: #111827;
  }

  p {
    margin-bottom: 1rem;
    color: #374151;
  }

  ul {
    margin-bottom: 1.5rem;
    padding-left: 1.2rem;
    color: #374151;
  }

  li {
    margin-bottom: 0.5rem;
  }

  .actions {
    display: flex;
    justify-content: flex-start;
  }

  .btn-primary {
    background: #0f172a;
    color: #ffffff;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    transition: background 0.2s ease;
  }

  .btn-primary:hover {
    background: #1e293b;
  }
</style>
