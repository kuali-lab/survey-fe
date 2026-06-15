<script lang="ts">
  import Logo from './Logo.svelte'

  let {
    state,
    title = '',
  }: {
    state: 'done' | 'expired' | 'device'
    title?: string
  } = $props()

  const cfg = $derived(
    state === 'done'
      ? {
          tone: 'success' as const,
          icon: 'check' as const,
          eyebrow: 'Terima kasih',
          heading: 'Survei telah selesai',
          message:
            'Anda sudah menyelesaikan survei ini dan jawaban Anda tersimpan. Untuk mengisi ulang, mintalah undangan baru dari penyelenggara.',
        }
      : state === 'device'
        ? {
            tone: 'info' as const,
            icon: 'device' as const,
            eyebrow: 'Sudah pernah mengisi',
            heading: 'Survei ini sudah diisi dari perangkat ini',
            message:
              'Setiap perangkat hanya dapat mengisi survei ini satu kali. Gunakan perangkat lain bila Anda ingin mengisi sebagai responden berbeda.',
          }
        : {
            tone: 'warning' as const,
            icon: 'clock' as const,
            eyebrow: 'Tautan tidak berlaku',
            heading: 'Tautan undangan telah kedaluwarsa',
            message:
              'Tautan undangan ini sudah tidak dapat digunakan. Silakan minta undangan terbaru dari penyelenggara survei.',
          },
  )
</script>

<div class="blocked">
  <div class="logo-bar">
    <Logo height={24} />
  </div>

  <div class="icon-circle" data-tone={cfg.tone} aria-hidden="true">
    {#if cfg.icon === 'check'}
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" />
        <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {:else if cfg.icon === 'device'}
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.6" />
        <path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        <path d="M9.5 9.8l1.8 1.8L15 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {:else}
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" />
        <path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </div>

  <div class="body">
    {#if title}
      <span class="eyebrow">{cfg.eyebrow}</span>
    {/if}
    <h1 class="heading">{cfg.heading}</h1>
    <p class="message">{cfg.message}</p>
  </div>
</div>

<style>
  .blocked {
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
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
  }

  .icon-circle[data-tone='success'] {
    background: var(--success-tint);
    color: var(--success-strong);
  }
  .icon-circle[data-tone='info'] {
    background: var(--info-tint);
    color: var(--info-strong);
  }
  .icon-circle[data-tone='warning'] {
    background: var(--warning-tint);
    color: var(--warning-strong);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    width: 100%;
  }

  .eyebrow {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-body);
  }

  .heading {
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 32px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
    max-width: 380px;
  }

  .message {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-body);
    max-width: 400px;
  }

  @media (min-width: 768px) {
    .heading {
      font-size: 28px;
      line-height: 36px;
    }
    .message {
      font-size: 17px;
      line-height: 26px;
    }
  }
</style>
