<script lang="ts">
  let {
    title,
    titlePlain = '',
    description,
    imageUrl,
    imageLayout = 'center'
  }: {
    title: string
    titlePlain?: string
    description: string | null
    imageUrl: string | null
    imageLayout?: string | null
  } = $props()

  const layout = $derived(imageLayout ?? 'center')
  const isInline = $derived(layout === 'left' || layout === 'right')
</script>

<div class="closing" class:layout-inline={isInline} class:layout-right={layout === 'right'}>
  <div class="logo-bar">
    <img src="/logo-logika-teta.svg" alt="Logika Statistik" class="logo-img" />
  </div>

  {#if layout === 'center'}
    <div class="check-icon" aria-hidden="true">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="var(--ink)"/>
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="var(--on-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  {/if}

  {#if imageUrl}
    <div class="cover" class:cover-inline={isInline}>
      <img src={imageUrl} alt={titlePlain} />
    </div>
  {/if}

  <div class="body">
    {#if isInline}
      <div class="check-icon" aria-hidden="true">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="var(--ink)"/>
          <path d="M7 12.5l3.5 3.5 6.5-7" stroke="var(--on-ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    {/if}
    <h1 class="title" class:center-text={layout === 'center'}>{@html title}</h1>
    {#if description}
      <p class="description">{@html description}</p>
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
    gap: 20px;
  }

  .closing.layout-inline {
    max-width: 760px;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }
  .closing.layout-right {
    flex-direction: row-reverse;
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

  .cover {
    width: 100%;
    max-height: 320px;
    overflow: hidden;
    background: transparent;
    border-radius: var(--radius-card);
  }
  .cover.cover-inline {
    flex: 0 0 240px;
    height: 240px;
    background: transparent;
  }

  .cover img {
    width: 100%;
    height: auto;
    max-height: 320px;
    object-fit: contain;
    display: block;
  }
  .cover.cover-inline img {
    height: 100%;
    max-height: none;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }

  .closing:not(.layout-inline) .body {
    align-items: center;
  }

  .title {
    font-family: var(--font-display);
    font-size: 28px;
    line-height: 36px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .title.center-text {
    text-align: center;
  }

  .description {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-body);
    max-width: 440px;
    white-space: pre-wrap;
    text-align: center;
  }

  /* Rich-text markup from the builder (bold / italic / underline / alignment). */
  .title :global(b), .title :global(strong) { font-weight: 700; }
  .title :global(i), .title :global(em) { font-style: italic; }
  .title :global(u) { text-decoration: underline; }
  .title :global(p), .title :global(div) { margin: 0; }
  .description :global(b), .description :global(strong) { font-weight: 700; }
  .description :global(i), .description :global(em) { font-style: italic; }
  .description :global(u) { text-decoration: underline; }
  .description :global(p), .description :global(div) { margin: 0; }

  @media (max-width: 640px) {
    .closing.layout-inline {
      flex-direction: column;
    }
    .cover.cover-inline {
      flex: 0 0 auto;
      height: 200px;
    }
    .body {
      align-items: center;
      text-align: center;
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
