<script lang="ts">
  let { type }: { type: 'not_found' | 'server_error' | 'unknown' } = $props()

  const config = $derived(
    type === 'not_found'
      ? {
          code: '404',
          heading: 'Survei Tidak Ditemukan',
          message: 'Tautan survei yang Anda masukkan tidak valid atau survei sudah dihapus.',
          icon: 'search'
        }
      : {
          code: '500',
          heading: 'Terjadi Kesalahan',
          message: 'Terjadi kesalahan pada server. Silakan coba lagi beberapa saat.',
          icon: 'error'
        }
  )
</script>

<div class="card">
  <div class="illustration">
    {#if config.icon === 'search'}
      <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="27" cy="27" r="16" stroke="#d9dde3" stroke-width="3" fill="#f7f8f9"/>
        <path d="M39 39l10 10" stroke="#d9dde3" stroke-width="3.5" stroke-linecap="round"/>
        <path d="M21 27h12M27 21v12" stroke="#c8ccd2" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="27" y1="23" x2="27" y2="31" stroke="#c8ccd2" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    {:else}
      <svg width="72" height="72" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="26" fill="#f7f8f9" stroke="#d9dde3" stroke-width="2.5"/>
        <path d="M32 20v16" stroke="#c8ccd2" stroke-width="3" stroke-linecap="round"/>
        <circle cx="32" cy="43" r="2.5" fill="#c8ccd2"/>
      </svg>
    {/if}
  </div>

  <div class="body">
    <span class="code">{config.code}</span>
    <h1 class="heading">{config.heading}</h1>
    <p class="message">{config.message}</p>

    {#if type !== 'not_found'}
      <button class="retry" onclick={() => window.location.reload()}>
        Coba Lagi
      </button>
    {/if}
  </div>
</div>

<style>
  .card {
    background: white;
    border-radius: var(--radius-xl);
    max-width: 480px;
    width: 100%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    overflow: hidden;
  }

  .illustration {
    width: 100%;
    padding: 40px 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--tertiary-20);
  }

  .body {
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
  }

  .code {
    font-size: 13px;
    font-weight: 700;
    color: var(--tertiary-60);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: var(--tertiary-20);
    padding: 4px 10px;
    border-radius: var(--radius-xl);
  }

  .heading {
    font-size: 24px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.2;
  }

  .message {
    font-size: 16px;
    color: var(--tertiary-70);
    line-height: 1.6;
    max-width: 340px;
  }

  .retry {
    margin-top: 8px;
    background: var(--primary-50);
    color: #221500;
    font-family: var(--font);
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: var(--radius-xl);
    padding: 12px 28px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .retry:hover {
    background: #e8ae00;
  }
</style>
