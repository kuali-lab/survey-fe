<script lang="ts">
  let { progress }: { progress: number } = $props()

  const clamped = $derived(Math.min(100, Math.max(0, progress)))
</script>

<div class="progress-wrap">
  <div class="track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label="Progres survei">
    <div class="fill" style="width: {clamped}%"></div>
  </div>
  <span class="percent" aria-hidden="true">{clamped}%</span>
</div>

<style>
  .progress-wrap {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--canvas);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .track {
    flex: 1;
    height: 4px;
    background: var(--canvas-soft);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--ink);
    border-radius: var(--radius-pill);
    transition: width 0.3s ease;
  }

  .percent {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-body);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    min-width: 32px;
    text-align: right;
  }

  @media (min-width: 768px) {
    .progress-wrap {
      padding: 16px 24px;
    }
    .percent {
      font-size: 13px;
    }
  }
</style>
