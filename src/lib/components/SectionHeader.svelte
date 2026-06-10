<script lang="ts">
  let { title, description }: { title: string; description: string | null } = $props()
</script>

<div class="section-header">
  <h2 class="title">{@html title}</h2>
  {#if description}
    <p class="description">{@html description}</p>
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

  /* Rich-text markup from the builder (bold / italic / underline / alignment). */
  .title :global(b), .title :global(strong) { font-weight: 700; }
  .title :global(i), .title :global(em) { font-style: italic; }
  .title :global(u) { text-decoration: underline; }
  .title :global(p), .title :global(div) { margin: 0; }
  .description :global(b), .description :global(strong) { font-weight: 700; }
  .description :global(i), .description :global(em) { font-style: italic; }
  .description :global(u) { text-decoration: underline; }
  .description :global(p), .description :global(div) { margin: 0; }

  @media (min-width: 768px) {
    .title {
      font-size: 26px;
      line-height: 34px;
    }
  }
</style>
