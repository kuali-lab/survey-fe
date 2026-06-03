<script lang="ts">
  import type { PageData } from './$types.js'
  import { onMount, tick } from 'svelte'
  import { goto } from '$app/navigation'
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { page as pageStore } from '$app/stores'

  import ProgressBar from '$lib/components/ProgressBar.svelte'
  import SectionHeader from '$lib/components/SectionHeader.svelte'
  import QuestionCard from '$lib/components/QuestionCard.svelte'
  import NavButton from '$lib/components/NavButton.svelte'
  import SurveyorAppShell from '$lib/components/surveyor/SurveyorAppShell.svelte'
  import { loadSurveyorSession, type SurveyorSession } from '$lib/surveyorAuth.js'
  import {
    getSurveyorRunner,
    saveSurveyorAnswers,
  } from '$lib/runner/surveyorRunnerStore.svelte.js'
  import type { SurveyRunner } from '$lib/runner/SurveyRunner.svelte.js'
  import { getQuestionNumber } from '$lib/utils.js'
  import { captureGps, GpsCaptureError, type GpsFix } from '$lib/gps.js'

  let { data }: { data: PageData } = $props()

  let session = $state<SurveyorSession | null>(null)
  let runner = $state<SurveyRunner | null>(null)
  let gpsStatus = $state<'idle' | 'pending' | 'ok' | 'error'>('idle')
  let location = $state<GpsFix | null>(null)
  let prefersReducedMotion = $state(false)

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

    runner = getSurveyorRunner(
      () => data.survey,
      () => {
        goto(`/surveyor/s/${data.slug}/recap`)
      },
    )

    // Honor a ?q=<id> query for jumping back from the recap "Edit" affordance.
    const url = new URL(window.location.href)
    const qid = url.searchParams.get('q')
    if (qid) {
      runner.jumpTo(qid)
    }

    // Read the URL query reactively could re-trigger; only run once on mount.
    // Apply a default lastActiveTime if not set yet.
    if (runner.lastActiveTime === 0) runner.lastActiveTime = Date.now()

    startGpsCapture()

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      prefersReducedMotion = mq.matches
      const onChange = (e: MediaQueryListEvent) => { prefersReducedMotion = e.matches }
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
  })

  $effect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        runner?.pauseTimer()
      } else {
        runner?.resumeTimer()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  })

  function stashLocation(fix: GpsFix) {
    if (typeof localStorage === 'undefined') return
    try { localStorage.setItem(`surveyor:location:${data.slug}`, JSON.stringify(fix)) } catch { /* ignore */ }
  }

  function startGpsCapture() {
    gpsStatus = 'pending'
    captureGps({
      onProgress: (fix) => {
        // Keep the best-so-far in localStorage so the recap page can still
        // use a useful fix even if the surveyor advances before the chip
        // converges below the accuracy threshold.
        location = fix
        stashLocation(fix)
      },
    })
      .then((fix) => {
        location = fix
        stashLocation(fix)
        gpsStatus = 'ok'
      })
      .catch((err) => {
        if (err instanceof GpsCaptureError && err.code === 'unsupported') {
          gpsStatus = 'idle'
        } else {
          gpsStatus = 'error'
        }
      })
  }

  // Auto-save answers for fallback recap on reload.
  $effect(() => {
    if (!runner) return
    void runner.answers
    void runner.currentIndex
    if (data.slug && Object.keys(runner.answers).length > 0) {
      saveSurveyorAnswers(data.slug, {
        answers: runner.answers,
        currentIndex: runner.currentIndex,
        accumulatedTimeMs: runner.accumulatedTimeMs + (runner.lastActiveTime > 0 ? Date.now() - runner.lastActiveTime : 0),
      })
    }
  })

  // Focus first input on each new page (same as respondent flow).
  $effect(() => {
    if (!runner) return
    const id = runner.currentPage?.id
    if (!id) return
    void id
    void tick().then(() => {
      const stage = document.querySelector('.question-stage')
      if (!stage) return
      const inputTypes = new Set([
        'short_text', 'long_text', 'email', 'phone', 'website',
        'number', 'date', 'contact_info',
      ])
      const firstQ = runner!.currentPage?.questions[0]
      if (firstQ && inputTypes.has(firstQ.type)) {
        const input = stage.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
        input?.focus({ preventScroll: true })
      } else {
        const heading = stage.querySelector<HTMLElement>('[data-question-heading]')
        heading?.focus({ preventScroll: true })
      }
    })
  })

  function handleDiscard() {
    if (!runner) return
    if (typeof window === 'undefined') return
    const ok = window.confirm('Buang jawaban responden ini dan mulai ulang?')
    if (!ok) return
    runner.reset()
    // Clear the local recap-fallback storage too.
    try { localStorage.removeItem(`surveyor:answers:${data.slug}`) } catch {}
    goto(`/surveyor/s/${data.slug}/interview`, { replaceState: true })
  }

  const settings = $derived(data.survey?.settings ?? { showProgress: true, showBranding: true, showNavArrows: true, showNumbers: true, displayMode: 'one_per_page' as const })

  function onKeydown(e: KeyboardEvent) {
    if (runner) runner.handleKeydown(e)
  }
  function onFocusIn(e: FocusEvent) {
    if (runner) runner.handleFocusIn(e)
  }
  function onWheel(e: WheelEvent) {
    if (runner) runner.handleWheel(e)
  }
  function onTouchStart(e: TouchEvent) {
    if (runner) runner.handleTouchStart(e)
  }
  function onTouchEnd(e: TouchEvent) {
    if (runner) runner.handleTouchEnd(e)
  }
</script>

<svelte:head>
  <title>Wawancara · {data.survey?.title ?? 'Survei'}</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<svelte:window
  onkeydown={onKeydown}
  onfocusin={onFocusIn}
  onwheel={onWheel}
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
/>

{#if session && data.survey && runner}
  <SurveyorAppShell
    surveyTitle={data.survey.title}
    displayName={session.displayName}
    slug={data.slug}
    todayCount={session.stats.todayCount}
    totalCount={session.stats.totalCount}
    interviewStartedAt={runner.lastActiveTime || null}
    {gpsStatus}
    onDiscard={handleDiscard}
  />

  <div class="survey-wrap">
    {#if settings.showProgress}
      <ProgressBar progress={runner.progress} />
    {/if}

    <div class="meta-strip">
      <span>Pertanyaan {Math.min(runner.currentIndex + 1, runner.surveyPages.length)} dari {runner.surveyPages.length}</span>
    </div>

    <main class="content">
      <div
        class="question-stage"
        class:single-question={runner.currentPage?.questions.length === 1 && !runner.isScrollMode}
      >
        {#if runner.currentPage}
          {#key runner.currentPage.id}
            <div
              class="stage-slide"
              in:fly={{ y: prefersReducedMotion ? 0 : 16, duration: prefersReducedMotion ? 0 : 220, easing: cubicOut }}
            >
              {#if runner.currentPage.title}
                <SectionHeader
                  title={runner.currentPage.title}
                  description={runner.currentPage.description ?? null}
                />
              {/if}
              {#each runner.currentPage.questions as q (q.id)}
                <QuestionCard
                  question={q}
                  questionNumber={settings.showNumbers ? getQuestionNumber(q, runner.questions) : ''}
                  answer={runner.answers[q.id] ?? null}
                  validationError={runner.questionErrors[q.id] ?? null}
                  onAnswer={(val) => runner!.handleAnswer(q.id, val)}
                  onBlur={() => runner!.handleBlur(q.id)}
                  slug={data.slug}
                />
              {/each}
            </div>
          {/key}
        {/if}
      </div>

      {#if runner.autoAdvancing}
        <div class="auto-advance-hint" aria-live="polite">
          <span class="auto-advance-spinner" aria-hidden="true"></span>
          Lanjut otomatis…
        </div>
      {/if}

      <div class="nav">
        {#if runner.currentIndex > 0 && settings.showNavArrows}
          <NavButton label="Sebelumnya" onClick={runner.handleBack} variant="secondary" />
        {/if}
        <div class="nav-right">
          <NavButton label={runner.nextButtonLabel} onClick={runner.handleNext} variant="primary" />
        </div>
      </div>
    </main>
  </div>
{/if}

<style>
  .survey-wrap {
    min-height: calc(100dvh - 56px);
    background: var(--canvas);
    display: flex;
    flex-direction: column;
  }

  .meta-strip {
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 6px 20px 0;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-body);
    display: flex;
    justify-content: flex-end;
  }

  .content {
    flex: 1;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 8px 20px 16px;
    display: flex;
    flex-direction: column;
  }

  .question-stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 16px 0;
  }

  .question-stage.single-question {
    justify-content: center;
  }

  .stage-slide {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .question-stage:not(.single-question) .stage-slide {
    gap: 28px;
  }

  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 12px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }

  .nav-right {
    margin-left: auto;
  }

  @media (max-width: 767px) {
    .nav {
      position: sticky;
      bottom: 0;
      background: var(--canvas);
      margin: 12px -20px 0;
      padding: 12px 20px;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--canvas-soft);
      z-index: 5;
    }
  }

  .auto-advance-hint {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-body);
    margin: 8px 0 0;
    align-self: flex-start;
  }

  .auto-advance-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--canvas-soft);
    border-top-color: var(--ink);
    border-radius: 50%;
    animation: auto-spin 0.6s linear infinite;
  }

  @keyframes auto-spin {
    to { transform: rotate(360deg); }
  }

  @media (min-width: 768px) {
    .content {
      padding: 16px 24px 24px;
    }
    .stage-slide {
      gap: 20px;
    }
  }
</style>
