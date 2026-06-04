<script lang="ts">
  import type { PageData } from './$types.js'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { loadSurveyorSession, refreshSurveyorStats, type SurveyorSession } from '$lib/surveyorAuth.js'
  import { averageDuration, peekSurveyorRunner } from '$lib/runner/surveyorRunnerStore.svelte.js'
  import SurveyorAppShell from '$lib/components/surveyor/SurveyorAppShell.svelte'
  import SurveyorStats from '$lib/components/surveyor/SurveyorStats.svelte'

  let { data }: { data: PageData } = $props()

  let session = $state<SurveyorSession | null>(null)
  let lastInterviewAt = $state<number | null>(null)

  onMount(() => {
    const s = loadSurveyorSession()
    if (!s || s.slug !== data.slug) {
      goto(`/surveyor/s/${data.slug}`, { replaceState: true })
      return
    }
    session = s

    // Read the last-interview marker from localStorage (set on /done).
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`surveyor:lastSubmit:${data.slug}`)
      lastInterviewAt = raw ? Number(raw) : null
    }

    // Refresh authoritative stats in the background.
    refreshSurveyorStats().then((stats) => {
      if (stats) {
        session = { ...session!, stats }
      }
    })
  })

  const avg = $derived(data.slug ? averageDuration(data.slug) : null)

  function formatRelative(epochMs: number): string {
    const secs = Math.max(0, Math.floor((Date.now() - epochMs) / 1000))
    if (secs < 60) return 'baru saja'
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins} menit lalu`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} jam lalu`
    const days = Math.floor(hrs / 24)
    return `${days} hari lalu`
  }

  function formatDuration(s: number): string {
    const m = Math.floor(s / 60)
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  function startInterview() {
    // Reset any in-memory runner so the interview starts fresh.
    const r = peekSurveyorRunner()
    if (r) r.reset()
    goto(`/surveyor/s/${data.slug}/interview`)
  }
</script>

{#if session && data.survey}
  <SurveyorAppShell
    surveyTitle={data.survey.title}
    displayName={session.displayName}
    slug={data.slug}
    todayCount={session.stats.todayCount}
    totalCount={session.stats.totalCount}
  />

  <main class="wrap">
    <div class="card">
      <h1 class="hi">Halo, {session.displayName}</h1>
      <p class="welcome">Selamat datang kembali.</p>

      <SurveyorStats todayCount={session.stats.todayCount} totalCount={session.stats.totalCount} />

      <button class="cta" type="button" onclick={startInterview}>
        Mulai Wawancara Baru
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>

      {#if avg !== null || lastInterviewAt !== null}
        <div class="summary">
          <div class="summary-title">Ringkasan sesi</div>
          {#if avg !== null}
            <div class="summary-row">Rata-rata waktu wawancara: <strong>{formatDuration(avg)}</strong></div>
          {/if}
          {#if lastInterviewAt !== null}
            <div class="summary-row">Wawancara terakhir: <strong>{formatRelative(lastInterviewAt)}</strong></div>
          {/if}
        </div>
      {/if}
    </div>
  </main>
{:else if data.error}
  <main class="wrap">
    <div class="card">
      <h1 class="hi">Tidak dapat memuat survei</h1>
      <p class="welcome">Coba kembali ke halaman masuk.</p>
      <button class="cta" type="button" onclick={() => goto(`/surveyor/s/${data.slug}`)}>Kembali</button>
    </div>
  </main>
{/if}

<style>
  .wrap {
    min-height: calc(100dvh - 56px);
    background: var(--canvas);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 32px 16px;
  }

  .card {
    background: var(--canvas);
    max-width: 520px;
    width: 100%;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .hi {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 36px;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .welcome {
    font-size: 16px;
    color: var(--text-body);
    margin: -16px 0 0;
  }

  .cta {
    width: 100%;
    min-height: 56px;
    background: var(--ink);
    color: var(--on-ink);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 500;
    border: none;
    border-radius: var(--radius-pill);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 24px;
    transition: background 0.15s;
  }

  .cta:hover { background: var(--ink-elevated); }

  @media (prefers-reduced-motion: no-preference) {
    .cta:active { transform: scale(0.98); }
  }

  .summary {
    border-top: 1px solid var(--canvas-soft);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .summary-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-body);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
  }

  .summary-row {
    font-size: 14px;
    color: var(--text-primary);
  }
</style>
