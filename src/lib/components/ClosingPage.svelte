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
    <div class="check-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#16a34a"/>
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <h1 class="title">{title}</h1>

    {#if description}
      <p class="description">{description}</p>
    {:else}
      <p class="description">Terima kasih telah mengisi survei ini. Jawaban Anda telah berhasil disimpan.</p>
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
    display: flex;
    justify-content: center;
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

  .body {
    padding: 40px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }

  .check-icon {
    margin-bottom: 8px;
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
    max-width: 380px;
    white-space: pre-wrap;
  }
</style>
