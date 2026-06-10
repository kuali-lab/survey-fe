<script lang="ts">
  let {
    title,
    message,
    imageUrl
  }: {
    title: string
    message: string | null
    imageUrl: string | null
  } = $props()
</script>

<div class="closed">
  {#if imageUrl}
    <div class="cover">
      <img src={imageUrl} alt={title} />
    </div>
  {:else}
    <div class="illustration" aria-hidden="true">
      <svg width="80" height="80" viewBox="0 0 64 64" fill="none">
        <rect x="10" y="12" width="44" height="48" rx="4" fill="var(--canvas-soft)" stroke="var(--ink)" stroke-width="2"/>
        <rect x="22" y="8" width="20" height="10" rx="3" fill="var(--canvas)" stroke="var(--ink)" stroke-width="2"/>
        <path d="M24 36c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <rect x="20" y="36" width="24" height="18" rx="4" fill="var(--ink)"/>
        <circle cx="32" cy="44" r="3" fill="var(--canvas)"/>
        <rect x="30.5" y="44" width="3" height="5" rx="1.5" fill="var(--canvas)"/>
      </svg>
    </div>
  {/if}

  <div class="body">
    {#if title}
      <span class="eyebrow">{title}</span>
    {/if}
    <h1 class="heading">Pengumpulan jawaban telah ditutup</h1>
    {#if message}
      <p class="message">{@html message}</p>
    {:else}
      <p class="message">Survei ini sudah tidak menerima jawaban baru. Terima kasih atas minat Anda.</p>
    {/if}
  </div>
</div>

<style>
  .closed {
    background: var(--canvas);
    max-width: 560px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
  }

  .cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--canvas-soft);
    border-radius: var(--radius-card);
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .illustration {
    padding: 24px 0 8px;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
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
    max-width: 440px;
    white-space: pre-wrap;
  }

  @media (min-width: 768px) {
    .heading {
      font-size: 32px;
      line-height: 40px;
    }
    .message {
      font-size: 17px;
      line-height: 26px;
    }
  }
</style>
