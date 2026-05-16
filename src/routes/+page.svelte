<script>
  import Logo from '$lib/components/Logo.svelte'
</script>

<svelte:head>
  <title>Logika Statistik Survey</title>
  <meta name="description" content="Isi survei dari Logika Statistik — platform riset dan analisis statistik." />
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container">
  <div class="card">
    <Logo height={32} />
    <p>Masukkan tautan survei yang valid untuk mulai mengisi survei.</p>
    <p class="hint">Contoh: <code>/s/nama-survei</code></p>
  </div>
</div>

<style>
  .container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--tertiary-20);
  }

  .card {
    background: white;
    border-radius: var(--radius-lg);
    padding: 48px 32px;
    max-width: 480px;
    width: 100%;
    text-align: center;
    box-shadow: 0 2px 16px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  p {
    font-size: 16px;
    color: var(--tertiary-70);
    line-height: 1.5;
  }

  .hint {
    font-size: 14px;
    color: var(--tertiary-60);
    margin-top: -8px;
  }

  code {
    background: var(--tertiary-20);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    font-family: monospace;
    font-size: 13px;
  }
</style>
