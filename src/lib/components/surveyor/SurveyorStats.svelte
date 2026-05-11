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
    background: var(--primary-10);
    border: 1px solid var(--primary-30);
    border-radius: var(--radius-lg);
    padding: 16px 8px;
  }

  .stat {
    flex: 1;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-num {
    font-size: 28px;
    font-weight: 800;
    color: var(--tertiary-100);
    line-height: 1;
  }

  .stat-label {
    font-size: 12px;
    color: var(--tertiary-70);
    font-weight: 600;
  }

  .divider {
    width: 1px;
    background: var(--primary-30);
    margin: 4px 8px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--primary-10);
    color: #b45309;
    border: 1px solid var(--primary-30);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
  }

  .pill-num {
    font-size: 13px;
    font-weight: 800;
    color: var(--tertiary-100);
  }

  .pill-sep {
    opacity: 0.5;
  }

  .pill-label {
    font-size: 11px;
    letter-spacing: 0.02em;
  }
</style>
