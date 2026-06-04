<script lang="ts">
  import Logo from './Logo.svelte'

  let {
    title,
    description,
    imageUrl
  }: {
    title: string
    description: string | null
    imageUrl: string | null
  } = $props()
</script>

<div class="closing">
  <div class="logo-bar">
    <Logo height={36} />
  </div>

  <div class="check-icon" aria-hidden="true">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="var(--ink)"/>
      <path d="M7 12.5l3.5 3.5 6.5-7" stroke="var(--on-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>

  {#if imageUrl}
    <div class="cover">
      <img src={imageUrl} alt={title} />
    </div>
  {/if}

  <div class="body">
    <h1 class="title">{title}</h1>
    {#if description}
      <p class="description">{description}</p>
    {:else}
      <p class="description">Terima kasih telah mengisi survei ini. Jawaban Anda telah berhasil disimpan.</p>
    {/if}
  </div>
</div>

<style>
  .closing {
    background: var(--canvas);
    max-width: 560px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
  }

  .logo-bar {
    position: fixed;
    top: 24px;
    left: 24px;
    display: flex;
    align-items: center;
    z-index: 10;
  }

  .check-icon {
    margin-top: 8px;
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

  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .title {
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 36px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .description {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-body);
    max-width: 440px;
    white-space: pre-wrap;
  }

  @media (min-width: 768px) {
    .title {
      font-size: 36px;
      line-height: 44px;
    }
    .description {
      font-size: 17px;
      line-height: 26px;
    }
  }
</style>
