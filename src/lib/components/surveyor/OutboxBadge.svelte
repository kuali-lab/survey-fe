<script lang="ts">
  import { outboxStore } from '$lib/outboxStore.svelte.js'

  type Variant = 'idle' | 'sending' | 'queued' | 'offline' | 'offline_queued' | 'attention'

  const variant = $derived<Variant>(
    outboxStore.permanentFailCount > 0
      ? 'attention'
      : !outboxStore.online && outboxStore.pendingCount + outboxStore.sendingCount > 0
        ? 'offline_queued'
        : !outboxStore.online
          ? 'offline'
          : outboxStore.sendingCount > 0
            ? 'sending'
            : outboxStore.pendingCount > 0
              ? 'queued'
              : 'idle',
  )

  const pending = $derived(outboxStore.pendingCount + outboxStore.sendingCount)

  const label = $derived(
    variant === 'attention'
      ? `${outboxStore.permanentFailCount} perlu perhatian`
      : variant === 'offline_queued'
        ? `Offline · ${pending} antri`
        : variant === 'offline'
          ? 'Mode offline'
          : variant === 'sending'
            ? `Mengirim ${pending} antrian…`
            : variant === 'queued'
              ? `${pending} menunggu kirim`
              : '',
  )
</script>

{#if variant !== 'idle'}
  <span class="badge {variant}" aria-live="polite" title={label}>
    {#if variant === 'sending'}
      <span class="spinner" aria-hidden="true"></span>
    {:else if variant === 'offline' || variant === 'offline_queued'}
      <svg class="ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 2l20 20" />
        <path d="M5 12.55a11 11 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a16 16 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    {:else if variant === 'attention'}
      <svg class="ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    {:else}
      <svg class="ico" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9" />
      </svg>
    {/if}
    <span>{label}</span>
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: var(--radius-pill);
    line-height: 1.2;
    background: var(--canvas-soft);
    color: var(--text-primary);
    white-space: nowrap;
  }
  .badge.sending,
  .badge.queued {
    color: var(--info-strong);
    background: var(--info-tint);
  }
  .badge.offline,
  .badge.offline_queued {
    background: var(--warning-tint);
    color: var(--warning-strong);
  }
  .badge.attention {
    background: var(--error-bg);
    color: var(--error);
  }
  .spinner {
    width: 10px;
    height: 10px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: outbox-spin 0.8s linear infinite;
  }
  @keyframes outbox-spin {
    to { transform: rotate(360deg); }
  }
  .ico { flex-shrink: 0; }
</style>
