<script lang="ts">
  type Props = {
    status: 'idle' | 'pending' | 'ok' | 'error'
  }
  let { status }: Props = $props()

  const label = $derived(
    status === 'pending' ? 'Mengambil lokasi…'
    : status === 'ok' ? 'Lokasi terkunci'
    : status === 'error' ? 'Lokasi tidak tersedia'
    : '',
  )
</script>

{#if status !== 'idle'}
  <span class="badge {status}" aria-live="polite">
    {#if status === 'pending'}
      <span class="spinner" aria-hidden="true"></span>
    {:else if status === 'ok'}
      <svg class="ico" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 12 10 17 19 7" /></svg>
    {:else}
      <svg class="ico" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
    {/if}
    <span>{label}</span>
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    line-height: 1.2;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .badge.pending {
    color: var(--tertiary-70);
    background: var(--tertiary-20);
    border-color: var(--tertiary-30);
  }
  .badge.ok {
    color: #b45309;
    background: var(--primary-10);
    border-color: var(--primary-30);
  }
  .badge.error {
    color: var(--tertiary-70);
    background: var(--tertiary-20);
    border-color: var(--tertiary-30);
  }
  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: gps-spin 0.7s linear infinite;
  }
  @keyframes gps-spin {
    to { transform: rotate(360deg); }
  }
  .ico {
    flex-shrink: 0;
  }
</style>
