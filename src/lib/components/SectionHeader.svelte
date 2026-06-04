<script lang="ts">
  let { title, description }: { title: string; description: string | null } = $props()
</script>

<div class="section-header">
  <h2 class="title">{title}</h2>
  {#if description}
    <p class="description">{description}</p>
  {/if}
</div>

<style>
  .section-header {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0 12px;
    border-bottom: 1px solid var(--canvas-softer);
    margin-bottom: 8px;
  }

  .title {
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 30px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.005em;
  }

  .description {
    font-size: 15px;
    line-height: 22px;
    font-weight: 400;
    color: var(--text-body);
    white-space: pre-wrap;
  }

  @media (min-width: 768px) {
    .title {
      font-size: 26px;
      line-height: 34px;
    }
  }
</style>
