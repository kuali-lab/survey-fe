<script lang="ts">
  let { title, description }: { title: string; description: string | null } = $props()
</script>

<div class="section-header">
  <div class="icon-wrap">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="7" height="7" rx="1" fill="white"/>
      <rect x="14" y="3" width="7" height="7" rx="1" fill="white"/>
      <rect x="3" y="14" width="7" height="7" rx="1" fill="white"/>
      <rect x="14" y="14" width="7" height="7" rx="1" fill="white"/>
    </svg>
  </div>
  <div class="text">
    <h2 class="title">{title}</h2>
    {#if description}
      <p class="description">{description}</p>
    {/if}
  </div>
</div>

<style>
  .section-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: white;
    border-radius: var(--radius-lg);
    padding: 16px 20px;
    border-left: 4px solid var(--primary-50);
  }

  .icon-wrap {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    background: var(--tertiary-80);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.2;
  }

  .description {
    font-size: 16px;
    color: var(--tertiary-70);
    line-height: 1.5;
  }
</style>
