<script lang="ts">

  let {
    title,
    description,
    imageUrl,
    imageLayout = 'center'
  }: {
    title: string
    description: string | null
    imageUrl: string | null
    imageLayout?: string | null
  } = $props()

  const layout = $derived(imageLayout ?? 'center')
  const isInline = $derived(layout === 'left' || layout === 'right')
</script>

<div class="closing">
  <div class="logo-bar">
    <img src="/logo-logika-teta.svg" alt="Logika Statistik" class="logo-img" />
  </div>

  <div class="check-icon" aria-hidden="true">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="var(--ink)"/>
      <path d="M7 12.5l3.5 3.5 6.5-7" stroke="var(--on-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>

  {#if imageUrl && isInline}
    <!-- Side-by-side layout (left / right) -->
    <div class="inline-wrap" class:inline-right={layout === 'right'}>
      <div class="inline-img-wrap">
        <img src={imageUrl} alt={title} class="inline-img" />
      </div>
      <div class="inline-body">
        <h1 class="title">{title}</h1>
        {#if description}
          <p class="description">{description}</p>
        {:else}
          <p class="description">Terima kasih telah mengisi survei ini. Jawaban Anda telah berhasil disimpan.</p>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Center layout (default): image on top -->
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
  {/if}
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

  .logo-img {
    height: 36px;
    width: auto;
    display: block;
  }

  .check-icon {
    margin-top: 8px;
  }

  /* ── Center layout (image on top) ── */
  .cover {
    width: 100%;
    overflow: hidden;
    background: var(--canvas-soft);
    border-radius: var(--radius-card);
  }

  .cover img {
    width: 100%;
    display: block;
    object-fit: contain;
  }

  /* ── Inline layout (left / right) ── */
  .inline-wrap {
    display: flex;
    flex-direction: row;
    gap: 20px;
    align-items: flex-start;
    text-align: left;
  }

  .inline-right {
    flex-direction: row-reverse;
  }

  .inline-img-wrap {
    flex: 0 0 140px;
    border-radius: var(--radius-card);
    overflow: hidden;
    background: var(--canvas-soft);
  }

  .inline-img {
    width: 140px;
    height: 140px;
    object-fit: contain;
    display: block;
  }

  .inline-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ── Shared text styles ── */
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

  @media (max-width: 480px) {
    .inline-wrap {
      flex-direction: column;
    }
    .inline-img-wrap,
    .inline-img {
      width: 100%;
      flex: 0 0 auto;
      height: auto;
      max-height: 200px;
    }
    .inline-img {
      object-fit: contain;
    }
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
