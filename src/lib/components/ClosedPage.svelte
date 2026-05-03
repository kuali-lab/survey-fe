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

<div class="card">
  {#if imageUrl}
    <div class="cover">
      <img src={imageUrl} alt={title} />
    </div>
  {:else}
    <div class="illustration">
      <svg width="80" height="80" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Clipboard body -->
        <rect x="10" y="12" width="44" height="48" rx="4" fill="#f7f8f9" stroke="#d9dde3" stroke-width="2"/>
        <!-- Clipboard clip -->
        <rect x="22" y="8" width="20" height="10" rx="3" fill="white" stroke="#d9dde3" stroke-width="2"/>
        <!-- Lock shackle -->
        <path d="M24 36c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="#c8ccd2" stroke-width="2.5" stroke-linecap="round" fill="none"/>
        <!-- Lock body -->
        <rect x="20" y="36" width="24" height="18" rx="4" fill="#d9dde3"/>
        <!-- Lock keyhole -->
        <circle cx="32" cy="44" r="3" fill="#8c8f93"/>
        <rect x="30.5" y="44" width="3" height="5" rx="1.5" fill="#8c8f93"/>
      </svg>
    </div>
  {/if}

  <div class="body">
    <h1 class="heading">Pengumpulan Jawaban Telah Ditutup</h1>
    {#if title}
      <p class="survey-title">{title}</p>
    {/if}
    {#if message}
      <p class="message">{message}</p>
    {:else}
      <p class="message">Survei ini sudah tidak menerima jawaban baru. Terima kasih atas minat Anda.</p>
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

  .cover {
    width: 100%;
    height: 220px;
    overflow: hidden;
    background: var(--tertiary-10);
  }

  .cover img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .illustration {
    width: 100%;
    padding: 40px 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--tertiary-20);
  }

  .body {
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;
  }

  .heading {
    font-size: 24px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.2;
  }

  .survey-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--tertiary-60);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .message {
    font-size: 16px;
    color: var(--tertiary-70);
    line-height: 1.6;
    max-width: 380px;
    white-space: pre-wrap;
  }
</style>
