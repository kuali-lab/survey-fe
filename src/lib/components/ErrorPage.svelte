<script lang="ts">
  let { type }: { type: 'not_found' | 'server_error' | 'unknown' } = $props()

  const config = $derived(
    type === 'not_found'
      ? {
          code: '404',
          heading: 'Survei tidak ditemukan',
          message: 'Tautan survei yang Anda masukkan tidak valid atau survei sudah dihapus.',
          icon: 'search'
        }
      : {
          code: '500',
          heading: 'Terjadi kesalahan',
          message: 'Terjadi kesalahan pada server. Silakan coba lagi beberapa saat.',
          icon: 'error'
        }
  )
</script>

<div class="error-page">
  <div class="illustration" aria-hidden="true">
    {#if config.icon === 'search'}
      <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
        <circle cx="27" cy="27" r="16" stroke="var(--ink)" stroke-width="3" fill="var(--canvas-soft)"/>
        <path d="M39 39l10 10" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/>
      </svg>
    {:else}
      <svg width="72" height="72" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="26" fill="var(--canvas-soft)" stroke="var(--ink)" stroke-width="2.5"/>
        <path d="M32 20v16" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/>
        <circle cx="32" cy="43" r="2.5" fill="var(--ink)"/>
      </svg>
    {/if}
  </div>

  <div class="body">
    <span class="code">{config.code}</span>
    <h1 class="heading">{config.heading}</h1>
    <p class="message">{config.message}</p>

    {#if type !== 'not_found'}
      <button class="retry" type="button" onclick={() => window.location.reload()}>
        Coba lagi
      </button>
    {/if}
  </div>
</div>

<style>
  .error-page {
    background: var(--canvas);
    max-width: 480px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
  }

  .illustration {
    padding: 16px 0 0;
  }

  .body {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .code {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-body);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .heading {
    font-family: var(--font-display);
    font-size: 26px;
    line-height: 34px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .message {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-body);
    max-width: 340px;
  }

  .retry {
    margin-top: 8px;
    background: var(--ink);
    color: var(--on-ink);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-pill);
    padding: 12px 24px;
    cursor: pointer;
    transition: background 0.15s;
  }

  .retry:hover { background: var(--ink-elevated); }

  @media (prefers-reduced-motion: no-preference) {
    .retry:active { transform: scale(0.97); }
  }
</style>
