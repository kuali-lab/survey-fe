<script lang="ts">
  import Logo from './Logo.svelte'

  let {
    title = 'Satu langkah lagi: Izinkan akses lokasi',
    description = 'Survei ini meminta lokasi Anda sebagai bagian dari pengiriman jawaban.',
    ctaText = 'Izinkan & Kirim Jawaban',
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

<div class="card">
  <div class="logo-bar">
    <Logo height={24} />
  </div>

  <div class="location-icon-wrap">
    <div class="icon-circle">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" class="location-icon">
        <path d="M12 11a3 3 0 100-6 3 3 0 000 6z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M21 10.5c0 5-8.083 11.238-8.528 11.572a.75.75 0 01-.944 0C11.083 21.738 3 15.5 3 10.5a9 9 0 0118 0zM12 11.5a4 4 0 100-8 4 4 0 000 8z" fill="currentColor"/>
      </svg>
    </div>
  </div>

  <div class="body">
    <h1 class="title">{title}</h1>
    <p class="description">{description}</p>

    <ul class="trust-beats">
      <li><strong>Apa</strong> — hanya koordinat lokasi saat ini, bukan riwayat atau alamat.</li>
      <li><strong>Siapa</strong> — hanya pemilik survei yang melihatnya. Logika Teta tidak melacak Anda.</li>
      <li><strong>Kapan</strong> — diambil sekali, saat tombol di bawah Anda tekan.</li>
    </ul>

    {#if error}
      <div class="error-msg">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    <button class="cta" onclick={onStart} disabled={loading}>
      {#if loading}
        <span class="spinner" aria-hidden="true"></span>
        Mengambil lokasi…
      {:else}
        {ctaText}
      {/if}
    </button>

    {#if loading}
      <p class="hint">Pastikan GPS / Layanan Lokasi aktif di perangkat Anda. Bisa memakan waktu beberapa detik.</p>
    {/if}
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

  .location-icon-wrap {
    display: flex;
    justify-content: center;
    padding: 32px 32px 0;
  }

  .icon-circle {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--primary-10, #fff7d6);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .location-icon {
    color: var(--primary-50, #f7bb00);
  }

  .body {
    padding: 24px 32px 32px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.3;
  }

  .description {
    font-size: 15px;
    color: var(--tertiary-70);
    line-height: 1.6;
    max-width: 90%;
  }

  .trust-beats {
    list-style: none;
    padding: 12px 16px;
    margin: 0;
    background: var(--tertiary-10, #f7f7f4);
    border-radius: var(--radius-lg);
    width: 100%;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .trust-beats li {
    font-size: 13.5px;
    color: var(--tertiary-80, #4a4a45);
    line-height: 1.5;
  }

  .trust-beats strong {
    color: var(--tertiary-100);
    font-weight: 600;
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
    margin-top: 8px;
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

  .hint {
    font-size: 13px;
    color: var(--tertiary-70);
    line-height: 1.5;
    margin: 0;
  }

  .error-msg {
    display: flex;
    align-items: flex-start;
    text-align: left;
    gap: 8px;
    background: #fee2e2;
    color: #dc2626;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    font-size: 13.5px;
    font-weight: 500;
    width: 100%;
    margin-top: 4px;
  }

  .error-msg svg {
    flex-shrink: 0;
    margin-top: 1px;
  }
</style>
