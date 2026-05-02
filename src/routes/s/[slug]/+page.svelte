<script lang="ts">
  import type { PageData } from './$types.js'
  import type { ViewState, Answers, AnswerValue, Question } from '$lib/types.js'
  import { submitSurveyAnswers } from '$lib/api.js'
  import { computeFingerprint } from '$lib/fingerprint.js'
  import { getAnswerableQuestions, getQuestionNumber } from '$lib/utils.js'
  import { evaluateNext } from '$lib/skipLogic.js'
  import { page } from '$app/stores'
  import { onMount } from 'svelte'

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

  let { data }: { data: PageData } = $props()

  const survey = $derived(data.survey)
  const slug = $derived(data.slug)

  // Determine initial view state
  function getInitialViewState(): ViewState {
    if (data.error === 'survey_closed') return 'closed'
    if (!survey || data.error) return 'error'
    return 'welcome'
  }

  let viewState = $state<ViewState>(getInitialViewState())
  let answers = $state<Answers>({})
  let currentIndex = $state(0)
  let validationError = $state<string | null>(null)
  let submitting = $state(false)
  let submitError = $state<string | null>(null)
  let location = $state<{ latitude: number, longitude: number, accuracy?: number } | null>(null)
  let locationRequesting = $state(false)
  let selfie = $state<{ imageBase64: string } | null>(null)
  let fingerprintHash = $state<string | null>(null)

  onMount(() => {
    computeFingerprint().then(fp => { fingerprintHash = fp })
  })

  const questions = $derived(survey?.questions ?? [])
  const skipRules = $derived(survey?.skipRules ?? [])
  const settings = $derived(survey?.settings ?? { showProgress: true, showBranding: true, showNavArrows: true, showNumbers: true })

  const answerableQuestions = $derived(getAnswerableQuestions(questions))

  const welcomeQuestion = $derived(
    questions.find(q => q.type === 'welcome_page') ?? null
  )
  const closingQuestion = $derived(
    questions.find(q => q.type === 'closing_page') ?? null
  )

  const currentQuestion = $derived(
    answerableQuestions[currentIndex] ?? null
  )

  // Find section (question_group) for current question
  const currentSection = $derived((): Question | null => {
    if (!currentQuestion || !currentQuestion.groupId) return null
    return questions.find(q => q.type === 'question_group' && q.id === currentQuestion.groupId) ?? null
  })

  const progress = $derived(
    answerableQuestions.length > 0
      ? Math.round(((currentIndex + 1) / answerableQuestions.length) * 100)
      : 0
  )

  const questionNumber = $derived(
    currentQuestion ? getQuestionNumber(currentQuestion, questions) : ''
  )

  function validateAnswer(): boolean {
    if (!currentQuestion) return true

    const answer = answers[currentQuestion.id]

    // 1. Required Check
    if (currentQuestion.required) {
      if (answer === null || answer === undefined) {
        validationError = 'Pertanyaan ini wajib diisi.'
        return false
      }
      if (typeof answer === 'string' && answer.trim() === '') {
        validationError = 'Pertanyaan ini wajib diisi.'
        return false
      }
      if (Array.isArray(answer) && answer.length === 0) {
        validationError = 'Pilih minimal satu jawaban.'
        return false
      }
      if (currentQuestion.type === 'contact_info') {
        const c = answer as { firstName?: string; lastName?: string; phone?: string; email?: string }
        const filled = [c.firstName, c.lastName, c.phone, c.email].some(v => v && v.trim() !== '')
        if (!filled) {
          validationError = 'Isi minimal satu data kontak.'
          return false
        }
      }
    }

    // If not required and answer is empty, fast-track success.
    const isEmpty = answer === null || answer === undefined || (typeof answer === 'string' && answer.trim() === '') || (Array.isArray(answer) && answer.length === 0)
    if (!currentQuestion.required && isEmpty && currentQuestion.type !== 'file_upload') {
      return true
    }

    // 2. Range & Format Validation (Applies if required OR if optionally answered)
    // Number: validate min/max range
    if (currentQuestion.type === 'number') {
      let answerNum = answer;
      if (typeof answer === 'string' && answer.trim() !== '') {
        answerNum = Number(answer);
      }
      if (typeof answerNum === 'number' && !isNaN(answerNum)) {
        const minVal = currentQuestion.minValue !== undefined && currentQuestion.minValue !== null ? Number(currentQuestion.minValue) : null;
        const maxVal = currentQuestion.maxValue !== undefined && currentQuestion.maxValue !== null ? Number(currentQuestion.maxValue) : null;
        
        if (minVal !== null && answerNum < minVal) {
          validationError = `Nilai minimal adalah ${minVal}.`;
          return false;
        }
        if (maxVal !== null && answerNum > maxVal) {
          validationError = `Nilai maksimal adalah ${maxVal}.`;
          return false;
        }
      }
    }

    // File upload: block next while upload is in progress
    if (currentQuestion.type === 'file_upload') {
      const val = answers[currentQuestion.id]
      if (typeof val === 'string' && val === '__uploading__') {
        validationError = 'Tunggu hingga file selesai diunggah.'
        return false
      }
    }

    return true
  }


  async function handleStart() {
    validationError = null
    viewState = 'question'
    currentIndex = 0
  }

  // End-of-survey verification gate.
  // Order: selfie first (higher friction, capture while sunk-cost fresh), then location.
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
        // 'camera' may not be a recognized name in some browsers — query throws and we fall through.
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
        permState = status.state
      }
    } catch {
      // Permissions API for camera is not universally supported (notably Safari).
      // Fall through to letting SelfieCapturePage call getUserMedia and surface NotAllowedError.
    }

    if (permState === 'denied') {
      viewState = 'selfie_denied'
      return
    }
    viewState = 'selfie_capture'
  }

  function onSelfieComplete(imageBase64: string) {
    selfie = { imageBase64 }
    // Continue the gate chain: location next if required, else submit.
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
      // Older Safari may reject the 'geolocation' query — fall through to prompt path
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
          maximumAge: 0
        })
      })
      location = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }
      locationRequesting = false
      await handleSubmit()
    } catch (err) {
      locationRequesting = false
      if (err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED) {
        viewState = 'location_denied'
        return
      }
      let errMsg = 'Tidak dapat mengambil lokasi. Coba lagi.'
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.POSITION_UNAVAILABLE) errMsg = 'Informasi lokasi tidak tersedia. Pastikan GPS / Layanan Lokasi aktif di perangkat Anda.'
        else if (err.code === err.TIMEOUT) errMsg = 'Waktu permintaan lokasi habis. Coba lagi.'
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
      // Collect respondent email if there's an email question
      const emailQuestion = answerableQuestions.find(q => q.type === 'email')
      const respondentEmail = emailQuestion ? (answers[emailQuestion.id] as string | undefined) : undefined

      await submitSurveyAnswers(slug, answers, respondentEmail, location, fingerprintHash, selfie)
      viewState = 'closing'
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'submit_error'
      if (msg === 'already_submitted') {
        submitError = 'Survei ini sudah pernah Anda isi sebelumnya.'
        viewState = 'question'
      } else if (msg === 'survey_closed') {
        viewState = 'closed'
      } else {
        submitError = 'Terjadi kesalahan saat mengirim jawaban. Silakan coba lagi.'
        viewState = 'question'
      }
    } finally {
      submitting = false
    }
  }

  // Step indicator for the verification gate.
  // Counts how many gates the survey requires and what step the user is currently on.
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

  async function handleNext() {
    validationError = null

    if (!validateAnswer()) return

    if (!currentQuestion) return

    // Evaluate skip logic
    const next = evaluateNext(currentQuestion.id, answers, questions, skipRules)

    if (next === 'END') {
      await handleFinish()
      return
    }

    if (next !== null) {
      // Skip to specific question
      const targetIdx = answerableQuestions.findIndex(q => q.id === next)
      if (targetIdx >= 0) {
        currentIndex = targetIdx
        return
      }
    }

    // Normal advance
    if (currentIndex < answerableQuestions.length - 1) {
      currentIndex += 1
    } else {
      await handleFinish()
    }
  }

  function handleBack() {
    validationError = null
    if (currentIndex > 0) {
      currentIndex -= 1
    }
  }

  function handleAnswer(value: AnswerValue) {
    if (currentQuestion) {
      answers = { ...answers, [currentQuestion.id]: value }
      validationError = null
    }
  }

  const isLastQuestion = $derived(currentIndex === answerableQuestions.length - 1)
  const nextButtonLabel = $derived(isLastQuestion ? 'Kirim Jawaban' : 'Selanjutnya')
  const errorType = $derived(
    data.error === 'not_found' ? 'not_found' as const
    : data.error === 'server_error' ? 'server_error' as const
    : 'unknown' as const
  )

  // Metadata
  const pageTitle = $derived(
    survey ? `${survey.title} | Logika Teta` : 'Logika Teta Survey'
  )
  const metaDescription = $derived(
    (welcomeQuestion?.description ?? survey?.title ?? 'Isi survei dari Logika Teta — platform riset dan analisis statistik.').slice(0, 160)
  )
  const ogImage = $derived(
    welcomeQuestion?.imageUrl ?? `${$page.url.origin}/logo-logika-teta.png`
  )
  const canonicalUrl = $derived(
    `${$page.url.origin}/s/${data.slug}`
  )
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={metaDescription} />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Survey pages are reached via direct link, not search -->
  <meta name="robots" content="noindex, nofollow" />

  <!-- Open Graph -->
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:type" content="website" />

  <!-- Twitter Card -->
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={metaDescription} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="twitter:card" content={welcomeQuestion?.imageUrl ? 'summary_large_image' : 'summary'} />
</svelte:head>

<div class="page">
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
      <WelcomePage
        title={welcomeQuestion?.title || survey?.title || ''}
        description={welcomeQuestion?.description ?? null}
        imageUrl={welcomeQuestion?.imageUrl ?? null}
        ctaText={'Mulai Survei'}
        onStart={handleStart}
        error={validationError}
      />
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

  {:else if viewState === 'question' || viewState === 'submitting'}
    <div class="survey-wrap">
      {#if settings.showProgress}
        <ProgressBar progress={progress} />
      {/if}

      <div class="content">
        {#if currentSection()}
          <SectionHeader
            title={currentSection()!.title}
            description={currentSection()!.description ?? null}
          />
        {/if}

        {#if currentQuestion}
          {#key currentQuestion.id}
            <QuestionCard
              question={currentQuestion}
              questionNumber={settings.showNumbers ? questionNumber : ''}
              answer={answers[currentQuestion.id] ?? null}
              validationError={validationError}
              onAnswer={handleAnswer}
              {slug}
            />
          {/key}
        {/if}

        {#if submitError}
          <div class="submit-error">{submitError}</div>
        {/if}

        <div class="nav">
          {#if currentIndex > 0 && settings.showNavArrows}
            <NavButton
              label="Sebelumnya"
              onClick={handleBack}
              variant="secondary"
              disabled={submitting}
            />
          {/if}
          <div class="nav-right">
            <NavButton
              label={nextButtonLabel}
              onClick={handleNext}
              variant="primary"
              disabled={submitting}
              loading={submitting}
            />
          </div>
        </div>
      </div>
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
  }

  .centered-wrap {
    min-height: 100vh;
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

  .survey-wrap {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .content {
    flex: 1;
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
    padding: 24px 16px 48px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }

  .nav-right {
    margin-left: auto;
  }

  .submit-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: var(--radius-md);
    color: var(--error-50);
    padding: 12px 16px;
    font-size: 14px;
  }
</style>
