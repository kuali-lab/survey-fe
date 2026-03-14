<script lang="ts">
  import Logo from './Logo.svelte'

  let {
    title,
    description,
    imageUrl,
    ctaText,
    onStart
  }: {
    title: string
    description: string | null
    imageUrl: string | null
    ctaText: string
    onStart: () => void
  } = $props()
</script>

<div class="card">
  <div class="logo-bar">
    <Logo height={24} />
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

    <button class="cta" onclick={onStart}>
      {ctaText}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
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

  .cover {
    width: 100%;
    height: 220px;
    overflow: hidden;
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .logo-bar {
    padding: 20px 32px 0;
  }

  .body {
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .title {
    font-size: 28px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.2;
  }

  .description {
    font-size: 16px;
    color: var(--tertiary-70);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--primary-50);
    color: #221500;
    font-family: var(--font);
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: var(--radius-xl);
    padding: 14px 28px;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-top: 8px;
  }

  .cta:hover {
    background: #e8ae00;
  }

  .cta:active {
    transform: scale(0.98);
  }
</style>
