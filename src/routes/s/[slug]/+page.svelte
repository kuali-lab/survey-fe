<script lang="ts">
  import type { PageData } from './$types.js'
  import type { ViewState, Answers } from '$lib/types.js'
  import { submitSurveyAnswers, saveDraft, getDraft, deleteDraft, trackInvitationClick, reportInvitationProgress } from '$lib/api.js'
  import { computeFingerprint } from '$lib/fingerprint.js'
  import { getQuestionNumber } from '$lib/utils.js'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount, tick, untrack } from 'svelte'
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'

  import ProgressBar from '$lib/components/ProgressBar.svelte'
  import SectionHeader from '$lib/components/SectionHeader.svelte'
  import WelcomePage from '$lib/components/WelcomePage.svelte'
  import LocationPromptPage from '$lib/components/LocationPromptPage.svelte'
  import LocationDeniedPage from '$lib/components/LocationDeniedPage.svelte'
  import SelfieCapturePage from '$lib/components/SelfieCapturePage.svelte'
  import SelfieDeniedPage from '$lib/components/SelfieDeniedPage.svelte'
  import ClosingPage from '$lib/components/ClosingPage.svelte'
  import ClosedPage from '$lib/components/ClosedPage.svelte'
  import ErrorPage from '$lib/components/ErrorPage.svelte'
  import QuestionCard from '$lib/components/QuestionCard.svelte'
  import NavButton from '$lib/components/NavButton.svelte'
  import { loadSurveyorSession } from '$lib/surveyorAuth.js'
  import { SurveyRunner } from '$lib/runner/SurveyRunner.svelte.js'

  let { data }: { data: PageData } = $props()

  const survey = $derived(data.survey)
  const slug = $derived(data.slug)

  function getInitialViewState(): ViewState {
    if (data.error === 'survey_closed' || survey?.status === 'closed') return 'closed'
    if (!survey || data.error) return 'error'
    return 'welcome'
  }

  let viewState = $state<ViewState>(getInitialViewState())
  let submitting = $state(false)
  let submitError = $state<string | null>(null)
  let validationError = $state<string | null>(null)
  let location = $state<{ latitude: number; longitude: number; accuracy?: number } | null>(null)
  let locationRequesting = $state(false)
  let selfie = $state<{ imageBase64: string } | null>(null)
  let fingerprintHash = $state<string | null>(null)
  let prefersReducedMotion = $state(false)
  let resumePrompt = $state<{ answers: Answers; currentIndex: number; accumulatedTimeMs?: number } | null>(null)
  // Invitation token captured from ?t= on first mount; null for anonymous fill.
  let invitationToken = $state<string | null>(null)
  let invitationStartedFired = false

  const runner = new SurveyRunner({
    getSurvey: () => survey ?? null,
    onFinish: () => handleFinish(),
  })

  // Persisted respondent state, keyed per survey slug. Selfie/location are
  // intentionally NOT persisted (privacy + size).
  type SavedState = {
    answers: Answers
    currentIndex: number
    accumulatedTimeMs: number
    savedAt: number
  }
  const STORAGE_TTL_MS = 30 * 24 * 3600 * 1000
  // Draft state is scoped per invitation token (not just per survey slug). This is
  // the fix for the reopen bug: a respondent who completed the survey and is then
  // re-invited arrives with a NEW token, so there is no saved state under the new
  // key → they start fresh instead of resuming the old (completed) fill at the
  // wrong question. A genuinely interrupted fill resumes only under its own token.
  // Anonymous fills (no token) share one per-slug key as before.
  const storageKey = (s: string) => `survey-fe:state:${s}:${invitationToken ?? 'anon'}`
  // Server-draft session key mirrors the same token scoping on top of the device
  // fingerprint, so a new token never loads a previous token's server draft.
  const draftSessionKey = (fp: string) => (invitationToken ? `${fp}:${invitationToken}` : fp)

  function loadSavedState(s: string): SavedState | null {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(storageKey(s))
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<SavedState>
      if (typeof parsed?.currentIndex !== 'number') return null
      if (!parsed.answers || typeof parsed.answers !== 'object') return null
      if (parsed.savedAt && Date.now() - parsed.savedAt > STORAGE_TTL_MS) {
        localStorage.removeItem(storageKey(s))
        return null
      }
      
      // Fallback for old localStorage format that used startTime
      if (typeof parsed.accumulatedTimeMs !== 'number') {
        const anyParsed = parsed as any
        parsed.accumulatedTimeMs = anyParsed.startTime || 0
      }
      return parsed as SavedState
    } catch {
      return null
    }
  }

  function saveCurrentState() {
    if (typeof localStorage === 'undefined') return
    if (!data.slug) return
    if (Object.keys(runner.answers).length === 0) return
    try {
      const state: SavedState = {
        answers: runner.answers,
        currentIndex: runner.currentIndex,
        accumulatedTimeMs: runner.accumulatedTimeMs + (runner.lastActiveTime > 0 ? Date.now() - runner.lastActiveTime : 0),
        savedAt: Date.now(),
      }
      localStorage.setItem(storageKey(data.slug), JSON.stringify(state))
    } catch {
      // localStorage may be disabled (private mode) or full — fail silently.
    }
  }

  function clearSavedState() {
    if (typeof localStorage === 'undefined') return
    if (!data.slug) return
    try { localStorage.removeItem(storageKey(data.slug)) } catch {}
  }

  function resumeSurvey() {
    if (!resumePrompt) return
    runner.loadFrom(resumePrompt)
    resumePrompt = null
    viewState = 'question'
  }

  function discardSavedState() {
    clearSavedState()
    resumePrompt = null
  }

  onMount(() => {
    // Capture ?t= invitation token before we strip it from the URL. Persisted
    // to sessionStorage so a mid-survey reload retains the link to the invite.
    if (typeof window !== 'undefined' && data.slug) {
      const tokenKey = `survey-fe:invtoken:${data.slug}`
      const fromQuery = $page.url.searchParams.get('t')
      const fromSession = sessionStorage.getItem(tokenKey)
      if (fromQuery) {
        invitationToken = fromQuery
        try { sessionStorage.setItem(tokenKey, fromQuery) } catch {}
        trackInvitationClick(fromQuery)
        // Strip the token from the URL so a casual share/copy doesn't leak it.
        try {
          const cleanUrl = new URL(window.location.href)
          cleanUrl.searchParams.delete('t')
          history.replaceState({}, '', cleanUrl)
        } catch {}
      } else if (fromSession) {
        invitationToken = fromSession
      }
    }

    computeFingerprint().then(async (fp) => {
      fingerprintHash = fp
      if (!resumePrompt && fp && data.slug && !data.error) {
        try {
          const serverDraft = await getDraft(data.slug, draftSessionKey(fp))
          if (serverDraft && serverDraft.currentPageIndex > 0 && Object.keys(serverDraft.answers).length > 0) {
            resumePrompt = { answers: serverDraft.answers, currentIndex: serverDraft.currentPageIndex, accumulatedTimeMs: 0 }
          }
        } catch { /* server unavailable — continue without draft */ }
      }
    })

    // Surveyor session present for this slug: jump to the surveyor app shell.
    // The respondent page itself is respondent-only now.
    if (data.slug && !data.error) {
      const session = loadSurveyorSession()
      if (session && session.slug === data.slug) {
        goto(`/surveyor/s/${data.slug}/ready`, { replaceState: true })
        return
      }
    }

    if (data.slug && !data.error) {
      const saved = loadSavedState(data.slug)
      if (saved && saved.currentIndex >= 0 && Object.keys(saved.answers).length > 0) {
        resumePrompt = saved
      }
    }

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
        runner.pauseTimer()
      } else {
        runner.resumeTimer()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  })

  // Auto-save on every answer/index change while in the question view.
  $effect(() => {
    void runner.answers
    void runner.currentIndex
    if (viewState !== 'question') return
    saveCurrentState()
  })

  // Mark the invite as 'started' the first time the respondent supplies any
  // answer in the question stage. Idempotent on the backend (status only moves
  // forward from sent/clicked/pending), but we also dedupe on the client to
  // avoid spamming the rate-limited endpoint.
  $effect(() => {
    void runner.answers
    if (viewState !== 'question' || !invitationToken || invitationStartedFired) return
    if (Object.keys(runner.answers).length === 0) return
    invitationStartedFired = true
    reportInvitationProgress(invitationToken, 'started')
  })

  // Save draft to backend each time respondent navigates to a new page.
  // Only tracks currentIndex — answers/viewState/slug/fp read with untrack() so they don't trigger re-runs.
  let _draftInitialSkip = true
  $effect(() => {
    const idx = runner.currentIndex
    const fp  = untrack(() => fingerprintHash)
    const vs  = untrack(() => viewState)
    const ans = untrack(() => runner.answers)
    const s   = untrack(() => slug)
    if (vs !== 'question') return
    if (_draftInitialSkip) { _draftInitialSkip = false; return }
    if (fp && s) saveDraft(s, draftSessionKey(fp), ans, idx).catch(() => {})
  })

  let questionErrors = $derived(runner.questionErrors)

  const welcomeQuestion = $derived(
    survey?.questions.find((q) => q.type === 'welcome_page') ?? null,
  )
  const closingQuestion = $derived(
    survey?.questions.find((q) => q.type === 'closing_page') ?? null,
  )
  const settings = $derived(survey?.settings ?? { showProgress: true, showBranding: true, showNavArrows: true, showNumbers: true })

  async function handleStart() {
    validationError = null
    runner.reset()
    viewState = 'question'
    clearSavedState()
    resumePrompt = null
  }

  // End-of-survey verification gate. Order: selfie first, then location.
  async function handleFinish() {
    if (settings.requireSelfie && !selfie) {
      await runSelfieGate()
      return
    }
    if (settings.requireLocation && !location) {
      await requestLocationAndSubmit()
      return
    }
    await handleSubmit()
  }

  async function runSelfieGate() {
    validationError = null
    let permState: PermissionState | null = null
    try {
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
        permState = status.state
      }
    } catch {
      // Permissions API for camera is not universally supported (notably Safari).
    }

    if (permState === 'denied') {
      viewState = 'selfie_denied'
      return
    }
    viewState = 'selfie_capture'
  }

  function onSelfieComplete(imageBase64: string) {
    selfie = { imageBase64 }
    handleFinish()
  }

  function onSelfieDenied() {
    viewState = 'selfie_denied'
  }

  async function requestLocationAndSubmit() {
    validationError = null

    let permState: PermissionState | null = null
    try {
      if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
        permState = status.state
      }
    } catch {
      // Older Safari may reject the 'geolocation' query
    }

    if (permState === 'denied') {
      viewState = 'location_denied'
      return
    }

    if (permState === 'granted') {
      await fetchLocationThenSubmit()
      return
    }

    viewState = 'location_prompt'
  }

  async function fetchLocationThenSubmit() {
    validationError = null
    locationRequesting = true
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        })
      })
      location = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
      locationRequesting = false
      await handleSubmit()
    } catch (err) {
      locationRequesting = false
      if (err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED) {
        viewState = 'location_denied'
        return
      }
      let errMsg = 'Tidak dapat mengambil lokasi. Periksa izin lokasi pada perangkat Anda.'
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.POSITION_UNAVAILABLE) errMsg = 'Informasi lokasi tidak tersedia. Pastikan GPS atau Layanan Lokasi aktif pada perangkat Anda.'
        else if (err.code === err.TIMEOUT) errMsg = 'Permintaan lokasi melebihi batas waktu. Coba lagi.'
      }
      validationError = errMsg
      viewState = 'location_prompt'
    }
  }

  async function handleSubmit() {
    submitting = true
    submitError = null
    viewState = 'submitting'

    try {
      const emailQuestion = runner.answerableQuestions.find((q) => q.type === 'email')
      const respondentEmail = emailQuestion ? (runner.answers[emailQuestion.id] as string | undefined) : undefined
      const durationSeconds = runner.getDurationSeconds()

      await submitSurveyAnswers(slug, runner.answers, respondentEmail, location, durationSeconds, fingerprintHash, selfie, undefined, undefined, invitationToken)

      clearSavedState()
      if (fingerprintHash && slug) deleteDraft(slug, draftSessionKey(fingerprintHash)).catch(() => {})
      if (invitationToken) reportInvitationProgress(invitationToken, 'completed')
      viewState = 'closing'
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'submit_error'
      if (msg === 'already_submitted') {
        submitError = 'Survei ini sudah pernah Anda isi sebelumnya.'
        viewState = 'question'
        clearSavedState()
      } else if (msg === 'survey_closed') {
        viewState = 'closed'
        clearSavedState()
      } else {
        submitError = 'Terjadi kesalahan saat mengirim jawaban. Silakan coba lagi.'
        viewState = 'question'
      }
    } finally {
      submitting = false
    }
  }

  // Step indicator for the verification gate.
  const gateSteps = $derived.by(() => {
    const steps: Array<'selfie' | 'location'> = []
    if (settings.requireSelfie) steps.push('selfie')
    if (settings.requireLocation) steps.push('location')
    return steps
  })

  const gateCurrentIndex = $derived.by(() => {
    if (viewState === 'selfie_capture' || viewState === 'selfie_denied') return gateSteps.indexOf('selfie')
    if (viewState === 'location_prompt' || viewState === 'location_denied') return gateSteps.indexOf('location')
    return -1
  })

  const showStepIndicator = $derived(gateSteps.length > 1 && gateCurrentIndex >= 0)

  // Focus the first input on each new page.
  $effect(() => {
    const id = runner.currentPage?.id
    if (viewState !== 'question' || !id) return
    void id
    void tick().then(() => {
      const stage = document.querySelector('.question-stage')
      if (!stage) return
      const inputTypes = new Set([
        'short_text', 'long_text', 'email', 'phone', 'website',
        'number', 'date', 'contact_info',
      ])
      const firstQ = runner.currentPage?.questions[0]
      if (firstQ && inputTypes.has(firstQ.type)) {
        const input = stage.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
        input?.focus({ preventScroll: true })
      } else {
        const heading = stage.querySelector<HTMLElement>('[data-question-heading]')
        heading?.focus({ preventScroll: true })
      }
    })
  })

  const errorType = $derived(
    data.error === 'not_found' ? 'not_found' as const
    : data.error === 'server_error' ? 'server_error' as const
    : 'unknown' as const,
  )

  const pageTitle = $derived(
    survey ? `${survey.title} | Logika Statistik` : 'Logika Statistik Survey',
  )
  const metaDescription = $derived(
    (welcomeQuestion?.description ?? survey?.title ?? 'Isi survei dari Logika Statistik — platform riset dan analisis statistik.').slice(0, 160),
  )
  const ogImage = $derived(
    welcomeQuestion?.imageUrl ?? `${$page.url.origin}/logo-logika-teta.png`,
  )
  const canonicalUrl = $derived(
    `${$page.url.origin}/s/${data.slug}`,
  )

  // Event wiring — only react while on the question stage and not submitting.
  function onKeydown(e: KeyboardEvent) {
    if (viewState !== 'question' || submitting) return
    runner.handleKeydown(e)
  }
  function onFocusIn(e: FocusEvent) {
    if (viewState !== 'question') return
    runner.handleFocusIn(e)
  }
  function onWheel(e: WheelEvent) {
    if (viewState !== 'question' || submitting) return
    runner.handleWheel(e)
  }
  function onTouchStart(e: TouchEvent) {
    if (viewState !== 'question') return
    runner.handleTouchStart(e)
  }
  function onTouchEnd(e: TouchEvent) {
    if (viewState !== 'question' || submitting) return
    runner.handleTouchEnd(e)
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={metaDescription} />
  <link rel="canonical" href={canonicalUrl} />

  <meta name="robots" content="noindex, nofollow" />

  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:type" content="website" />

  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={metaDescription} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="twitter:card" content={welcomeQuestion?.imageUrl ? 'summary_large_image' : 'summary'} />
</svelte:head>

<svelte:window
  onkeydown={onKeydown}
  onfocusin={onFocusIn}
  onwheel={onWheel}
  ontouchstart={onTouchStart}
  ontouchend={onTouchEnd}
/>

<div class="page" class:page-question={viewState === 'question'}>
  {#if viewState === 'error'}
    <div class="centered-wrap">
      <ErrorPage type={errorType} />
    </div>

  {:else if viewState === 'closed'}
    <div class="centered-wrap">
      <ClosedPage
        title={survey?.title ?? ''}
        message={survey?.closeMessage ?? null}
        imageUrl={survey?.closeImageUrl ?? null}
      />
    </div>

  {:else if viewState === 'welcome'}
    <div class="centered-wrap">
      {#if resumePrompt}
        <div class="resume-card" role="region" aria-label="Lanjutkan survei">
          <h2 class="resume-title">Lanjutkan survei Anda</h2>
          <p class="resume-description">
            Jawaban sebelumnya tersimpan di perangkat ini. Anda dapat melanjutkan dari pertanyaan terakhir, atau memulai ulang dari awal.
          </p>
          <div class="resume-actions">
            <button class="resume-btn primary" type="button" onclick={resumeSurvey}>Lanjutkan</button>
            <button class="resume-btn secondary" type="button" onclick={discardSavedState}>Mulai dari awal</button>
          </div>
        </div>
      {:else}
        <WelcomePage
          title={welcomeQuestion?.title || survey?.title || ''}
          description={welcomeQuestion?.description ?? null}
          imageUrl={welcomeQuestion?.imageUrl ?? null}
          ctaText={'Mulai Survei'}
          onStart={handleStart}
          error={validationError}
        />
      {/if}
    </div>

  {:else if viewState === 'selfie_capture'}
    <div class="centered-wrap">
      {#if showStepIndicator}
        <div class="step-indicator">Langkah {gateCurrentIndex + 1} dari {gateSteps.length} · Foto Selfie</div>
      {/if}
      <SelfieCapturePage
        onComplete={onSelfieComplete}
        onDenied={onSelfieDenied}
        loading={submitting}
      />
    </div>

  {:else if viewState === 'selfie_denied'}
    <div class="centered-wrap">
      {#if showStepIndicator}
        <div class="step-indicator">Langkah {gateCurrentIndex + 1} dari {gateSteps.length} · Foto Selfie</div>
      {/if}
      <SelfieDeniedPage
        onRetry={() => { viewState = 'selfie_capture' }}
        loading={false}
      />
    </div>

  {:else if viewState === 'location_prompt'}
    <div class="centered-wrap">
      {#if showStepIndicator}
        <div class="step-indicator">Langkah {gateCurrentIndex + 1} dari {gateSteps.length} · Lokasi GPS</div>
      {/if}
      <LocationPromptPage
        onStart={fetchLocationThenSubmit}
        loading={locationRequesting}
        error={validationError}
      />
    </div>

  {:else if viewState === 'location_denied'}
    <div class="centered-wrap">
      {#if showStepIndicator}
        <div class="step-indicator">Langkah {gateCurrentIndex + 1} dari {gateSteps.length} · Lokasi GPS</div>
      {/if}
      <LocationDeniedPage
        onRetry={fetchLocationThenSubmit}
        loading={locationRequesting}
      />
    </div>

  {:else if viewState === 'submitting'}
    <div class="centered-wrap">
      <div class="submitting-card">
        <span class="big-spinner" aria-hidden="true"></span>
        <p>Mengirim jawaban…</p>
      </div>
    </div>

  {:else if viewState === 'question'}
    <div class="survey-wrap">
      {#if settings.showProgress}
        <ProgressBar progress={runner.progress} />
      {/if}

      <main class="content">
        <div
          class="question-stage"
          class:single-question={runner.currentPage?.questions.length === 1 && settings.displayMode !== 'scroll'}
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
                    validationError={questionErrors[q.id] ?? null}
                    onAnswer={(val) => runner.handleAnswer(q.id, val)}
                    onBlur={() => runner.handleBlur(q.id)}
                    {slug}
                  />
                {/each}
              </div>
            {/key}
          {/if}
        </div>

        {#if submitError}
          <div class="submit-error">{submitError}</div>
        {/if}

        {#if runner.autoAdvancing}
          <div class="auto-advance-hint" aria-live="polite">
            <span class="auto-advance-spinner" aria-hidden="true"></span>
            Lanjut otomatis…
          </div>
        {/if}

        <div class="nav">
          {#if runner.currentIndex > 0 && settings.showNavArrows}
            <NavButton
              label="Sebelumnya"
              onClick={runner.handleBack}
              variant="secondary"
              disabled={submitting}
            />
          {/if}
          <div class="nav-right">
            <NavButton
              label={runner.nextButtonLabel}
              onClick={runner.handleNext}
              variant="primary"
              disabled={submitting}
              loading={submitting}
            />
          </div>
        </div>
      </main>
    </div>

  {:else if viewState === 'closing'}
    <div class="centered-wrap">
      <ClosingPage
        title={closingQuestion?.title ?? 'Terima Kasih!'}
        description={closingQuestion?.description ?? null}
        imageUrl={closingQuestion?.imageUrl ?? null}
      />
    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    background: var(--tertiary-20);
    transition: background-color 0.2s ease;
  }

  .page.page-question {
    background: white;
  }

  .centered-wrap {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 16px;
    gap: 12px;
  }

  .step-indicator {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--tertiary-80, #4a4a45);
    background: white;
    border: 1px solid var(--tertiary-20, #ececea);
    border-radius: 999px;
    padding: 6px 14px;
    letter-spacing: 0.02em;
  }

  .submitting-card {
    background: white;
    border-radius: var(--radius-xl);
    padding: 40px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
  }

  .submitting-card p {
    font-size: 15px;
    font-weight: 600;
    color: var(--tertiary-90, #2a2a25);
    margin: 0;
  }

  .big-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--tertiary-30, #d8d8d2);
    border-top-color: var(--primary-50, #f7bb00);
    border-radius: 50%;
    animation: submit-spin 0.8s linear infinite;
  }

  @keyframes submit-spin {
    to { transform: rotate(360deg); }
  }

  .survey-wrap {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
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
      background: white;
      margin: 12px -20px 0;
      padding: 12px 20px;
      padding-bottom: max(12px, env(safe-area-inset-bottom));
      border-top: 1px solid var(--tertiary-20, #ececea);
      z-index: 5;
    }
  }

  .submit-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    color: var(--error-50);
    padding: 12px 16px;
    font-size: 14px;
    margin-top: 8px;
  }

  .auto-advance-hint {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--tertiary-70, #5a5a55);
    margin: 8px 0 0;
    align-self: flex-start;
  }

  .auto-advance-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #d9dde3;
    border-top-color: #f7bb00;
    border-radius: 50%;
    animation: auto-spin 0.6s linear infinite;
  }

  @keyframes auto-spin {
    to { transform: rotate(360deg); }
  }

  .resume-card {
    background: white;
    border-radius: var(--radius-xl);
    max-width: 480px;
    width: 100%;
    padding: 24px 24px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .resume-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--tertiary-100);
    margin: 0;
    line-height: 1.3;
  }

  .resume-description {
    font-size: 14px;
    color: var(--tertiary-70, #5a5a55);
    line-height: 1.55;
    margin: 0;
  }

  .resume-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .resume-btn {
    flex: 1;
    min-width: 140px;
    height: 48px;
    padding: 0 20px;
    border-radius: var(--radius-xl);
    font-family: var(--font);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.1s;
  }

  .resume-btn:active {
    transform: scale(0.97);
  }

  .resume-btn.primary {
    background: var(--primary-50);
    color: #221500;
    border: 2px solid transparent;
  }

  .resume-btn.primary:hover {
    background: #e8ae00;
  }

  .resume-btn.secondary {
    background: white;
    color: var(--tertiary-80);
    border: 2px solid #d9dde3;
  }

  .resume-btn.secondary:hover {
    border-color: #f7bb00;
    background: #fffbed;
  }

  @media (min-width: 768px) {
    .resume-card {
      padding: 32px 32px;
    }
    .resume-title {
      font-size: 22px;
    }
    .resume-description {
      font-size: 15px;
    }
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
