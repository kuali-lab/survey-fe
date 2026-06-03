<script lang="ts">
  import Logo from './Logo.svelte'

  let {
    title = 'Hampir selesai',
    description = 'Untuk mengirim jawaban, izinkan akses lokasi GPS saat browser meminta.',
    ctaText = 'Izinkan & kirim jawaban',
    onStart,
    error = null,
    loading = false
  }: {
    title?: string
    description?: string
    ctaText?: string
    onStart: () => void
    error?: string | null
    loading?: boolean
  } = $props()
</script>

<div class="gate">
  <div class="logo-bar">
    <Logo height={24} />
  </div>

  <div class="icon-circle" aria-hidden="true">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 11a3 3 0 100-6 3 3 0 000 6z" fill="currentColor"/>
      <path fill-rule="evenodd" clip-rule="evenodd" d="M21 10.5c0 5-8.083 11.238-8.528 11.572a.75.75 0 01-.944 0C11.083 21.738 3 15.5 3 10.5a9 9 0 0118 0zM12 11.5a4 4 0 100-8 4 4 0 000 8z" fill="currentColor"/>
    </svg>
  </div>

  <div class="body">
    <h1 class="title">{title}</h1>
    <p class="description">{description}</p>

    {#if error}
      <div class="error-msg" role="alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <button class="cta" type="button" onclick={onStart} disabled={loading}>
      {#if loading}
        <span class="spinner" aria-hidden="true"></span>
        Mengambil lokasi…
      {:else}
        {ctaText}
      {/if}
    </button>
  </div>
</div>

<style>
  .gate {
    background: var(--canvas);
    max-width: 480px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }

  .logo-bar {
    align-self: flex-start;
  }

  .icon-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--canvas-soft);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    align-items: center;
    width: 100%;
  }

  .title {
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 32px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .description {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-body);
    max-width: 90%;
  }

  .cta {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    width: 100%;
    background: var(--ink);
    color: var(--on-ink);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-pill);
    padding: 16px 24px;
    cursor: pointer;
    transition: background 0.15s;
    margin-top: 4px;
  }

  .cta:hover:not(:disabled) { background: var(--ink-elevated); }
  .cta:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (prefers-reduced-motion: no-preference) {
    .cta:active:not(:disabled) { transform: scale(0.98); }
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.35);
    border-top-color: var(--on-ink);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-msg {
    display: flex;
    align-items: flex-start;
    text-align: left;
    gap: 8px;
    background: var(--error-bg);
    color: var(--error);
    border: 1px solid var(--error-border);
    padding: 12px 16px;
    border-radius: var(--radius-input);
    font-size: 14px;
    font-weight: 500;
    width: 100%;
  }

  .error-msg svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
</style>
