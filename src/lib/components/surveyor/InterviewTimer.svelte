<script lang="ts">
  import { onMount, onDestroy } from 'svelte'

  type Props = {
    /** Epoch ms when the interview started. */
    startedAt: number
  }
  let { startedAt }: Props = $props()

  let now = $state(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    timer = setInterval(() => { now = Date.now() }, 1000)
  })
  onDestroy(() => {
    if (timer) clearInterval(timer)
  })

  const elapsed = $derived(Math.max(0, Math.floor((now - startedAt) / 1000)))
  const mm = $derived(Math.floor(elapsed / 60).toString().padStart(2, '0'))
  const ss = $derived((elapsed % 60).toString().padStart(2, '0'))
</script>

<span class="timer" aria-label="Waktu wawancara">
  <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
  <span class="time">{mm}:{ss}</span>
</span>

<style>
  .timer {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    font-weight: 700;
    color: var(--tertiary-80);
  }
  .icon {
    color: var(--primary-50);
  }
  .time {
    line-height: 1;
  }
</style>
