<script lang="ts">
  type Props = {
    todayCount: number
    totalCount: number
    /** Compact pill variant for the app shell badge. */
    variant?: 'card' | 'pill'
  }
  let { todayCount, totalCount, variant = 'card' }: Props = $props()
</script>

{#if variant === 'pill'}
  <span class="pill" title="Total: {totalCount}">
    <span class="pill-num">{todayCount}</span>
    <span class="pill-sep">·</span>
    <span class="pill-label">hari ini</span>
  </span>
{:else}
  <div class="stat-row">
    <div class="stat">
      <div class="stat-num">{todayCount}</div>
      <div class="stat-label">Hari ini</div>
    </div>
    <div class="divider" aria-hidden="true"></div>
    <div class="stat">
      <div class="stat-num">{totalCount}</div>
      <div class="stat-label">Total responden</div>
    </div>
  </div>
{/if}

<style>
  .stat-row {
    display: flex;
    align-items: stretch;
    background: var(--canvas-soft);
    border-radius: var(--radius-card);
    padding: 20px 12px;
  }

  .stat {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat-num {
    font-size: 32px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    letter-spacing: -0.01em;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 12px;
    color: var(--text-body);
    font-weight: 500;
  }

  .divider {
    width: 1px;
    background: var(--surface-pressed);
    margin: 4px 8px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--canvas-soft);
    color: var(--text-primary);
    border-radius: var(--radius-pill);
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
  }

  .pill-num {
    font-size: 13px;
    font-weight: 700;
    color: var(--tertiary-100);
    font-variant-numeric: tabular-nums;
  }

  .pill-sep {
    color: var(--text-muted);
  }

  .pill-label {
    font-size: 11px;
    letter-spacing: 0.02em;
    color: var(--text-body);
  }
</style>
