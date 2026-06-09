<script lang="ts">
  let {
    title,
    description,
    imageUrl,
    imageLayout = 'center',
    ctaText,
    onStart,
    error = null
  }: {
    title: string
    description: string | null
    imageUrl: string | null
    imageLayout?: string | null
    ctaText: string
    onStart: () => void
    error?: string | null
  } = $props()

  const layout = $derived(imageLayout ?? 'center')
  const isInline = $derived(layout === 'left' || layout === 'right')
</script>

<div class="welcome" class:layout-inline={isInline} class:layout-right={layout === 'right'}>
  <div class="logo-bar">
    <img src="/logo-logika-teta.svg" alt="Logika Statistik" class="logo-img" />
  </div>

  {#if imageUrl}
    <div class="cover" class:cover-inline={isInline}>
      <img src={imageUrl} alt={title} />
    </div>
  {/if}

  <div class="body">
    <h1 class="title" class:center-text={layout === 'center'}>{@html title}</h1>
    {#if description}
      <p class="description">{@html description}</p>
    {/if}

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

    <button class="cta" type="button" onclick={onStart} class:center-cta={layout === 'center'}>
      {ctaText}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</div>

<style>
  .welcome {
    background: var(--canvas);
    max-width: 560px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .welcome.layout-inline {
    max-width: 760px;
    flex-direction: row;
    align-items: center;
  }
  .welcome.layout-right {
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
    gap: 16px;
    flex: 1;
  }

  .title {
    font-family: var(--font-display);
    font-size: 32px;
    line-height: 40px;
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
    white-space: pre-wrap;
    text-align: center;
  }

  /* Rich-text markup from the builder (bold / italic / underline / alignment).
     execCommand wraps aligned content in <div>/<p>; strip their default margins. */
  .title :global(b), .title :global(strong) { font-weight: 700; }
  .title :global(i), .title :global(em) { font-style: italic; }
  .title :global(u) { text-decoration: underline; }
  .title :global(p), .title :global(div) { margin: 0; }
  .description :global(b), .description :global(strong) { font-weight: 700; }
  .description :global(i), .description :global(em) { font-style: italic; }
  .description :global(u) { text-decoration: underline; }
  .description :global(p), .description :global(div) { margin: 0; }

  .cta {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--ink);
    color: var(--on-ink);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-pill);
    padding: 14px 28px;
    cursor: pointer;
    transition: background 0.15s;
    margin-top: 4px;
  }
  .cta.center-cta {
    align-self: center;
  }

  .cta:hover { background: var(--ink-elevated); }

  @media (prefers-reduced-motion: no-preference) {
    .cta:active { transform: scale(0.97); }
  }

  .error-msg {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--error-bg);
    color: var(--error);
    border: 1px solid var(--error-border);
    padding: 12px 16px;
    border-radius: var(--radius-input);
    font-size: 14px;
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .welcome.layout-inline {
      flex-direction: column;
    }
    .cover.cover-inline {
      flex: 0 0 auto;
      height: 200px;
    }
    .title, .cta {
      align-self: center;
      text-align: center;
    }
  }

  @media (min-width: 768px) {
    .title {
      font-size: 40px;
      line-height: 48px;
    }
    .description {
      font-size: 17px;
      line-height: 26px;
    }
  }
</style>
<!-- Trigger fix redeploy -->
