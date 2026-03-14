<div class="container">
  <div class="card">
    <div class="icon">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="#f7bb00" stroke-width="2"/>
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#f7bb00" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <h1>Logika Survey</h1>
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
  }

  .icon {
    margin-bottom: 16px;
  }

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: var(--tertiary-100);
    margin-bottom: 12px;
  }

  p {
    font-size: 16px;
    color: var(--tertiary-70);
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .hint {
    font-size: 14px;
    color: var(--tertiary-60);
    margin-top: 8px;
  }

  code {
    background: var(--tertiary-20);
    border-radius: var(--radius-sm);
    padding: 2px 6px;
    font-family: monospace;
    font-size: 13px;
  }
</style>
