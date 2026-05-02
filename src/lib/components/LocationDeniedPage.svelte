<script lang="ts">
  import Logo from './Logo.svelte'

  let {
    onRetry,
    loading = false
  }: {
    onRetry: () => void
    loading?: boolean
  } = $props()

  let showInstructions = $state(false)
</script>

<div class="card">
  <div class="logo-bar">
    <Logo height={24} />
  </div>

  <div class="icon-wrap">
    <div class="icon-circle">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="icon">
        <path d="M12 11a3 3 0 100-6 3 3 0 000 6z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M21 10.5c0 5-8.083 11.238-8.528 11.572a.75.75 0 01-.944 0C11.083 21.738 3 15.5 3 10.5a9 9 0 0118 0zM12 11.5a4 4 0 100-8 4 4 0 000 8z" fill="currentColor"/>
        <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
  </div>

  <div class="body">
    <h1 class="title">Akses lokasi diblokir</h1>
    <p class="description">
      Survei ini mewajibkan lokasi untuk dapat dikirim, tetapi browser Anda memblokir akses.
      Aktifkan kembali akses lokasi untuk situs ini, lalu coba lagi.
    </p>

    <button class="link-btn" onclick={() => (showInstructions = !showInstructions)}>
      {showInstructions ? 'Sembunyikan' : 'Cara mengaktifkan lokasi'}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style:transform={showInstructions ? 'rotate(180deg)' : 'rotate(0)'}>
        <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    {#if showInstructions}
      <div class="instructions">
        <div class="instr-block">
          <strong>Chrome / Edge (desktop)</strong>
          <p>Klik ikon gembok di kiri address bar → <em>Site settings</em> → <em>Location</em> → <em>Allow</em>, lalu muat ulang halaman.</p>
        </div>
        <div class="instr-block">
          <strong>Safari (Mac)</strong>
          <p>Menu Safari → <em>Settings for This Website…</em> → <em>Location</em> → <em>Allow</em>.</p>
        </div>
        <div class="instr-block">
          <strong>Chrome / Safari (iPhone)</strong>
          <p>Buka <em>Settings</em> iOS → <em>Privacy & Security</em> → <em>Location Services</em> → pilih browser Anda → <em>While Using the App</em>.</p>
        </div>
        <div class="instr-block">
          <strong>Chrome (Android)</strong>
          <p>Tap menu titik tiga → <em>Settings</em> → <em>Site settings</em> → <em>Location</em> → cari survey.logika-teta.web.id → <em>Allow</em>.</p>
        </div>
      </div>
    {/if}

    <button class="cta" onclick={onRetry} disabled={loading}>
      {#if loading}
        <span class="spinner" aria-hidden="true"></span>
        Mengambil lokasi…
      {:else}
        Coba lagi
      {/if}
    </button>

    <p class="contact-hint">
      Tidak dapat mengaktifkan lokasi? Hubungi pemilik survei untuk informasi lebih lanjut.
    </p>
  </div>
</div>

<style>
  .card {
    background: white;
    border-radius: var(--radius-xl);
    max-width: 520px;
    width: 100%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
    overflow: hidden;
  }

  .logo-bar {
    padding: 20px 32px 0;
  }

  .icon-wrap {
    display: flex;
    justify-content: center;
    padding: 32px 32px 0;
  }

  .icon-circle {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: #fee2e2;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon {
    color: #dc2626;
  }

  .body {
    padding: 24px 32px 32px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
  }

  .title {
    font-size: 22px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.3;
  }

  .description {
    font-size: 15px;
    color: var(--tertiary-70);
    line-height: 1.6;
  }

  .link-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: none;
    color: var(--tertiary-90);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    text-decoration: underline;
  }

  .link-btn svg {
    transition: transform 0.2s;
  }

  .instructions {
    width: 100%;
    text-align: left;
    background: var(--tertiary-10, #f7f7f4);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .instr-block strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: var(--tertiary-100);
    margin-bottom: 4px;
  }

  .instr-block p {
    font-size: 13px;
    color: var(--tertiary-80, #4a4a45);
    line-height: 1.5;
    margin: 0;
  }

  .instr-block em {
    font-style: normal;
    font-weight: 600;
    color: var(--tertiary-100);
  }

  .cta {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: var(--primary-50);
    color: #221500;
    font-family: var(--font);
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: var(--radius-xl);
    padding: 16px 28px;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-top: 4px;
  }

  .cta:hover:not(:disabled) {
    background: #e8ae00;
  }

  .cta:active:not(:disabled) {
    transform: scale(0.98);
  }

  .cta:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(34, 21, 0, 0.25);
    border-top-color: #221500;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .contact-hint {
    font-size: 13px;
    color: var(--tertiary-70);
    line-height: 1.5;
    margin: 0;
  }
</style>
