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
    background: white;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .track {
    flex: 1;
    height: 4px;
    background: #d9dde3;
    border-radius: 100px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: #f7bb00;
    border-radius: 100px;
    transition: width 0.3s ease;
  }

  .percent {
    font-size: 12px;
    font-weight: 700;
    color: var(--tertiary-70, #5a5a55);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
    min-width: 32px;
    text-align: right;
  }

  @media (min-width: 768px) {
    .progress-wrap {
      padding: 12px 24px;
    }
    .percent {
      font-size: 13px;
    }
  }
</style>
