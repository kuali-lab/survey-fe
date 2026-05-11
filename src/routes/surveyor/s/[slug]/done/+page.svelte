<script lang="ts">
  import type { PageData } from './$types.js'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { loadSurveyorSession, refreshSurveyorStats, clearSurveyorSession, type SurveyorSession } from '$lib/surveyorAuth.js'
  import SurveyorAppShell from '$lib/components/surveyor/SurveyorAppShell.svelte'
  import SubmissionStatusCard from '$lib/components/surveyor/SubmissionStatusCard.svelte'
  import { outboxStore } from '$lib/outboxStore.svelte.js'
  import { drain } from '$lib/outboxDrain.js'

  let { data }: { data: PageData } = $props()

  let session = $state<SurveyorSession | null>(null)
  let lastDurationSeconds = $state<number | null>(null)
  let submissionId = $state<string | null>(null)
  let statsRefreshed = $state(false)

  onMount(() => {
    const s = loadSurveyorSession()
    if (!s || s.slug !== data.slug) {
      goto(`/surveyor/s/${data.slug}`, { replaceState: true })
      return
    }
    session = s

    try {
      const raw = localStorage.getItem(`surveyor:lastDuration:${data.slug}`)
      lastDurationSeconds = raw ? Number(raw) : null
    } catch {
      // ignore
    }

    submissionId = new URL(window.location.href).searchParams.get('sid')
  })

  const item = $derived(submissionId ? outboxStore.getBySubmissionId(submissionId) ?? null : null)

  // When a submission finally lands, refresh the server-authoritative
  // counters once. The badge in the shell updates as a side effect.
  $effect(() => {
    if (item?.status === 'sent' && !statsRefreshed) {
      statsRefreshed = true
      void refreshSurveyorStats().then((stats) => {
        if (stats && session) session = { ...session, stats }
      })
    }
  })

  function formatDuration(s: number | null): string | null {
    if (s === null || s <= 0) return null
    const m = Math.floor(s / 60)
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  const duration = $derived(formatDuration(lastDurationSeconds))

  function nextRespondent() {
    goto(`/surveyor/s/${data.slug}/interview`, { replaceState: true })
  }

  function finishShift() {
    clearSurveyorSession()
    goto(`/surveyor/s/${data.slug}`, { replaceState: true })
  }

  function retryNow() {
    void drain()
  }
</script>

<svelte:head>
  <title>Tersimpan · {data.survey?.title ?? 'Survei'}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if session && data.survey}
  <SurveyorAppShell
    surveyTitle={data.survey.title}
    displayName={session.displayName}
    slug={data.slug}
    todayCount={session.stats.todayCount}
    totalCount={session.stats.totalCount}
  />

  <main class="wrap">
    {#if submissionId}
      <SubmissionStatusCard
        item={item}
        onRetry={item?.status === 'permanent_fail' ? retryNow : null}
      />
    {:else}
      <!-- Fallback for direct navigation without ?sid -->
      <div class="legacy-card">
        <div class="check">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="5 12 10 17 19 7" />
          </svg>
        </div>
        <h1 class="title">Tersimpan</h1>
      </div>
    {/if}

    <div class="info-row">
      {#if duration}
        <span class="info-pill">Durasi: <strong>{duration}</strong></span>
      {/if}
      {#if item?.status === 'sent'}
        <span class="info-pill success">Responden #{session.stats.todayCount} tercatat</span>
      {:else if item?.status === 'pending' || item?.status === 'sending'}
        <span class="info-pill muted">Akan masuk hitungan saat terkirim</span>
      {/if}
    </div>

    <div class="actions">
      <button class="btn primary" type="button" onclick={nextRespondent}>
        Mulai Responden Berikutnya
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
      <button class="btn secondary" type="button" onclick={finishShift}>Selesai Bertugas</button>
    </div>
  </main>
{/if}

<style>
  .wrap {
    min-height: calc(100dvh - 56px);
    background: var(--tertiary-20);
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
  }

  .wrap > :global(*) {
    width: 100%;
    max-width: 520px;
  }

  .legacy-card {
    background: white;
    border-radius: var(--radius-xl);
    padding: 32px 24px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
  }

  .check {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #dcfce7;
    color: #16a34a;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .title {
    font-size: 22px;
    font-weight: 800;
    color: var(--tertiary-100);
    margin: 0;
    line-height: 1.2;
  }

  .info-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .info-pill {
    background: white;
    border: 1px solid var(--tertiary-30);
    border-radius: 999px;
    padding: 4px 12px;
    font-size: 12.5px;
    color: var(--tertiary-80);
  }
  .info-pill.success {
    background: #f0fdf4;
    border-color: #bbf7d0;
    color: #15803d;
  }
  .info-pill.muted {
    color: var(--tertiary-60);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 4px;
  }

  .btn {
    width: 100%;
    min-height: 48px;
    border-radius: var(--radius-xl);
    font-family: var(--font);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    border: 2px solid transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 20px;
    transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.1s;
  }
  .btn:active { transform: scale(0.98); }

  .btn.primary {
    background: var(--primary-50);
    color: #221500;
  }
  .btn.primary:hover { background: #e8ae00; }

  .btn.secondary {
    background: white;
    border-color: var(--tertiary-30);
    color: var(--tertiary-80);
  }
  .btn.secondary:hover {
    border-color: var(--primary-50);
    background: var(--primary-10);
  }
</style>
