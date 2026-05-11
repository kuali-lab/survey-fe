<script lang="ts">
  import { onMount } from 'svelte'
  import { onDrainEvent } from '$lib/outboxDrain.js'

  type Toast = {
    id: number
    kind: 'success' | 'error'
    text: string
    sticky: boolean
  }

  let toasts = $state<Toast[]>([])
  let nextId = 1

  // Aggregate bursts: if multiple items drain at once, show one toast with the count.
  let pendingSuccesses = 0
  let aggregateTimer: ReturnType<typeof setTimeout> | null = null

  function flushAggregate() {
    if (pendingSuccesses === 0) return
    const count = pendingSuccesses
    pendingSuccesses = 0
    pushToast({
      kind: 'success',
      text: count === 1 ? '1 jawaban terkirim ke server' : `${count} jawaban terkirim ke server`,
      sticky: false,
    })
  }

  function pushToast(t: Omit<Toast, 'id'>) {
    const id = nextId++
    toasts = [...toasts, { ...t, id }]
    if (!t.sticky) {
      setTimeout(() => dismiss(id), 4000)
    }
  }

  function dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id)
  }

  onMount(() => {
    const offSent = onDrainEvent('outbox:sent', () => {
      pendingSuccesses++
      if (aggregateTimer) clearTimeout(aggregateTimer)
      aggregateTimer = setTimeout(flushAggregate, 600)
    })
    const offFailed = onDrainEvent('outbox:failed', (_item, permanent) => {
      if (!permanent) return
      pushToast({
        kind: 'error',
        text: 'Ada kiriman gagal — buka halaman kiriman untuk detail',
        sticky: true,
      })
    })
    return () => { offSent(); offFailed() }
  })
</script>

{#if toasts.length > 0}
  <div class="stack" role="region" aria-live="polite">
    {#each toasts as t (t.id)}
      <div class="toast {t.kind}">
        {#if t.kind === 'success'}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"/></svg>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>
        {/if}
        <span>{t.text}</span>
        <button class="close" type="button" aria-label="Tutup" onclick={() => dismiss(t.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .stack {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 60;
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px 10px 14px;
    border-radius: 999px;
    font-size: 13.5px;
    font-weight: 600;
    border: 1px solid;
    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
    max-width: 90vw;
  }
  .toast.success {
    background: #f0fdf4;
    color: #15803d;
    border-color: #bbf7d0;
  }
  .toast.error {
    background: #fef2f2;
    color: #b91c1c;
    border-color: #fecaca;
  }
  .close {
    background: transparent;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 2px;
    display: inline-flex;
  }
  .close:hover { opacity: 1; }
</style>
