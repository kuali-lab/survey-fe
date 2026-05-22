<script lang="ts">
  import type { PageData } from './$types.js'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { loadSurveyorSession, type SurveyorSession } from '$lib/surveyorAuth.js'
  import {
    peekSurveyorRunner,
    loadSurveyorAnswers,
    clearSurveyorAnswers,
    pushDuration,
  } from '$lib/runner/surveyorRunnerStore.svelte.js'
  import SurveyorAppShell from '$lib/components/surveyor/SurveyorAppShell.svelte'
  import RecapList from '$lib/components/surveyor/RecapList.svelte'
  import type { Answers } from '$lib/types.js'
  import { outbox, type GpsFix } from '$lib/outbox.js'
  import { drain } from '$lib/outboxDrain.js'

  let { data }: { data: PageData } = $props()

  let session = $state<SurveyorSession | null>(null)
  let answers = $state<Answers>({})
  let accumulatedTimeMs = $state<number>(0)
  let submitting = $state(false)
  let submitError = $state<string | null>(null)

  onMount(() => {
    const s = loadSurveyorSession()
    if (!s || s.slug !== data.slug) {
      goto(`/surveyor/s/${data.slug}`, { replaceState: true })
      return
    }
    if (!data.survey || data.error) {
      goto(`/surveyor/s/${data.slug}/ready`, { replaceState: true })
      return
    }
    session = s

    // Prefer the in-memory runner. Fall back to localStorage if the page
    // was reloaded (in-memory state is gone).
    const r = peekSurveyorRunner()
    if (r && Object.keys(r.answers).length > 0) {
      answers = r.answers
      accumulatedTimeMs = r.accumulatedTimeMs + (r.lastActiveTime > 0 ? Date.now() - r.lastActiveTime : 0)
    } else {
      const fb = loadSurveyorAnswers(data.slug)
      if (fb) {
        answers = fb.answers
        accumulatedTimeMs = fb.accumulatedTimeMs
      } else {
        // Nothing to recap; bounce back to interview.
        goto(`/surveyor/s/${data.slug}/interview`, { replaceState: true })
        return
      }
    }
  })

  const questions = $derived(data.survey?.questions ?? [])

  function backToInterview() {
    goto(`/surveyor/s/${data.slug}/interview`)
  }

  function editQuestion(qid: string) {
    goto(`/surveyor/s/${data.slug}/interview?q=${encodeURIComponent(qid)}`)
  }

  async function submit() {
    if (!session || !data.survey) return
    submitting = true
    submitError = null

    let location: GpsFix | null = null
    try {
      const raw = localStorage.getItem(`surveyor:location:${data.slug}`)
      if (raw) location = JSON.parse(raw)
    } catch {
      // ignore
    }

    const emailQ = data.survey.questions.find((q) => q.type === 'email')
    const respondentEmail = emailQ ? (answers[emailQ.id] as string | undefined) : undefined
    const durationSeconds = accumulatedTimeMs > 0 ? Math.round(accumulatedTimeMs / 1000) : undefined

    const submissionId = crypto.randomUUID()
    try {
      await outbox.enqueue({
        submissionId,
        slug: data.slug,
        payload: {
          answers,
          respondentEmail: respondentEmail ?? null,
          location,
          durationSeconds: durationSeconds ?? null,
          fingerprintHash: null,
          selfie: null,
          surveyorCode: session.code,
        },
      })

      // Local-only bookkeeping fires on enqueue: from the surveyor's
      // perspective the interview is complete, regardless of upload state.
      if (durationSeconds && durationSeconds > 0) pushDuration(data.slug, durationSeconds)
      clearSurveyorAnswers(data.slug)
      const r = peekSurveyorRunner()
      if (r) r.reset()
      try { localStorage.setItem(`surveyor:lastSubmit:${data.slug}`, String(Date.now())) } catch {}
      try { localStorage.setItem(`surveyor:lastDuration:${data.slug}`, String(durationSeconds ?? 0)) } catch {}

      // Kick the drain immediately so we don't wait for the 30s poll
      // when the surveyor is online.
      void drain()

      goto(`/surveyor/s/${data.slug}/done?sid=${submissionId}`, { replaceState: true })
    } catch (err) {
      console.error('[recap] enqueue failed', err)
      const msg = err instanceof Error ? err.message : String(err)
      submitError = `Belum bisa menyimpan jawaban di perangkat (${msg}). Coba tekan Kirim Jawaban sekali lagi.`
      submitting = false
    }
  }
</script>

<svelte:head>
  <title>Tinjau Jawaban · {data.survey?.title ?? 'Survei'}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if session && data.survey}
  <SurveyorAppShell
    surveyTitle={data.survey.title}
    displayName={session.displayName}
    slug={data.slug}
    todayCount={session.stats.todayCount}
    totalCount={session.stats.totalCount}
    interviewStartedAt={Date.now() - accumulatedTimeMs}
  />

  <main class="wrap">
    <header class="head">
      <button class="back-link" type="button" onclick={backToInterview}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Kembali ke pertanyaan
      </button>
      <h1 class="title">Tinjau Jawaban</h1>
      <p class="lede">Bacakan jawaban bersama responden sebelum mengirim.</p>
    </header>

    <RecapList questions={questions} answers={answers} onEdit={editQuestion} />

    {#if submitError}
      <div class="submit-error">{submitError}</div>
    {/if}

    <div class="actions">
      <button class="btn secondary" type="button" onclick={backToInterview} disabled={submitting}>
        ← Kembali
      </button>
      <button class="btn primary" type="button" onclick={submit} disabled={submitting}>
        {submitting ? 'Menyimpan…' : 'Kirim Jawaban'}
        {#if !submitting}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="5 12 10 17 19 7" />
          </svg>
        {/if}
      </button>
    </div>
  </main>
{/if}

<style>
  .wrap {
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 24px 20px 80px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .back-link {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: none;
    color: var(--tertiary-70);
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 0;
  }

  .back-link:hover {
    color: var(--tertiary-100);
  }

  .title {
    font-size: 22px;
    font-weight: 800;
    color: var(--tertiary-100);
    line-height: 1.2;
    margin: 0;
  }

  .lede {
    font-size: 14px;
    color: var(--tertiary-70);
    margin: 0;
  }

  .submit-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    color: var(--error-50);
    padding: 12px 16px;
    font-size: 14px;
  }

  .actions {
    display: flex;
    gap: 12px;
    padding-top: 8px;
  }

  .btn {
    flex: 1;
    min-height: 52px;
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
  .btn.primary:hover:not(:disabled) {
    background: #e8ae00;
  }

  .btn.secondary {
    background: white;
    border-color: var(--tertiary-30);
    color: var(--tertiary-80);
  }
  .btn.secondary:hover:not(:disabled) {
    border-color: var(--primary-50);
    background: var(--primary-10);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 600px) {
    .actions {
      position: sticky;
      bottom: 0;
      background: var(--tertiary-20);
      margin: 0 -20px;
      padding: 12px 20px;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--tertiary-30);
    }
  }
</style>
