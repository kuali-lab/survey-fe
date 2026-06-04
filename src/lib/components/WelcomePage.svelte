<script lang="ts">
  import Logo from './Logo.svelte'

  let {
    title,
    description,
    imageUrl,
    ctaText,
    onStart,
    error = null
  }: {
    title: string
    description: string | null
    imageUrl: string | null
    ctaText: string
    onStart: () => void
    error?: string | null
  } = $props()
</script>

<div class="welcome">
  <div class="logo-bar">
    <Logo height={36} />
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

    <button class="cta" type="button" onclick={onStart}>
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

  .logo-bar {
    position: absolute;
    top: 32px;
    left: 32px;
    display: flex;
    align-items: center;
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
    display: block;
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .title {
    font-family: var(--font-display);
    font-size: 32px;
    line-height: 40px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .description {
    font-size: 16px;
    line-height: 24px;
    color: var(--text-body);
    white-space: pre-wrap;
    text-align: center;
  }

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
