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
  let startTime = $state(0)

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

  let questionErrors = $state<Record<string, string>>({})

  type SurveyPage = {
    id: string
    title?: string
    description?: string
    questions: Question[]
  }

  const surveyPages = $derived.by((): SurveyPage[] => {
    if (!answerableQuestions.length) return []
    
    const mode = settings.displayMode || 'one_per_page'
    
    if (mode === 'scroll') {
      return [{
        id: 'all',
        questions: answerableQuestions
      }]
    }

    // one_per_page logic
    const hasGroups = questions.some(q => q.type === 'question_group')
    if (!hasGroups) {
      // True one per page if no groups exist
      return answerableQuestions.map(q => ({
        id: q.id,
        questions: [q]
      }))
    }

    // Group-based paging — preserve original sortOrder
    const pages: SurveyPage[] = []

    // Build group-id → answerable-members map (members already sorted by sortOrder)
    const groupMembers = new Map<string, Question[]>()
    for (const q of answerableQuestions) {
      if (q.groupId) {
        if (!groupMembers.has(q.groupId)) groupMembers.set(q.groupId, [])
        groupMembers.get(q.groupId)!.push(q)
      }
    }

    // Walk all questions in sortOrder; emit pages in creator-intended order
    const answerableSet = new Set(answerableQuestions.map(q => q.id))
    const sortedAll = [...questions].sort((a, b) => a.sortOrder - b.sortOrder)
    const addedGroups = new Set<string>()

    for (const q of sortedAll) {
      if (q.type === 'question_group') {
        const members = groupMembers.get(q.id)
        if (members && members.length > 0 && !addedGroups.has(q.id)) {
          pages.push({ id: q.id, title: q.title, description: q.description ?? undefined, questions: members })
          addedGroups.add(q.id)
        }
      } else if (!q.groupId && answerableSet.has(q.id)) {
        // Non-group answerable question: own page
        pages.push({ id: q.id, questions: [q] })
      }
      // Questions with groupId are emitted above when their group header is encountered
    }

    return pages
  })

  const currentPage = $derived(
    surveyPages[currentIndex] ?? null
  )

  const progress = $derived(
    surveyPages.length > 0
      ? Math.round(((currentIndex + 1) / surveyPages.length) * 100)
      : 0
  )

  function validateAnswer(): boolean {
    if (!currentPage) return true
    
    let isValid = true
    questionErrors = {}
    
    for (const q of currentPage.questions) {
      const answer = answers[q.id]
      let error = null
      
      // 1. Required Check
      if (q.required) {
        if (answer === null || answer === undefined) {
          error = 'Pertanyaan ini wajib diisi.'
        } else if (typeof answer === 'string' && answer.trim() === '') {
          error = 'Pertanyaan ini wajib diisi.'
        } else if (Array.isArray(answer) && answer.length === 0) {
          error = 'Pilih minimal satu jawaban.'
        } else if (q.type === 'contact_info') {
          const c = answer as { firstName?: string; lastName?: string; phone?: string; email?: string }
          const filled = [c.firstName, c.lastName, c.phone, c.email].some(v => v && v.trim() !== '')
          if (!filled) error = 'Isi minimal satu data kontak.'
        }
      }

      // If not required and answer is empty, fast-track success.
      const isEmpty = answer === null || answer === undefined || (typeof answer === 'string' && answer.trim() === '') || (Array.isArray(answer) && answer.length === 0)
      if (!error && !q.required && isEmpty && q.type !== 'file_upload') {
        continue
      }

      // 2. Range & Format Validation
      if (!error && q.type === 'number') {
        let answerNum = answer;
        if (typeof answer === 'string' && answer.trim() !== '') {
          answerNum = Number(answer);
        }
        if (typeof answerNum === 'number' && !isNaN(answerNum)) {
          const minVal = q.minValue !== undefined && q.minValue !== null ? Number(q.minValue) : null;
          const maxVal = q.maxValue !== undefined && q.maxValue !== null ? Number(q.maxValue) : null;
          
          if (minVal !== null && answerNum < minVal) {
            error = `Nilai minimal adalah ${minVal}.`;
          } else if (maxVal !== null && answerNum > maxVal) {
            error = `Nilai maksimal adalah ${maxVal}.`;
          }
        }
      }

      if (!error && q.type === 'file_upload') {
        const val = answers[q.id]
        if (typeof val === 'string' && val === '__uploading__') {
          error = 'Tunggu hingga file selesai diunggah.'
        }
      }

      if (error) {
        questionErrors[q.id] = error
        isValid = false
      }
    }

    if (!isValid) {
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.error')
        if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }

    return isValid
  }


  async function handleStart() {
    validationError = null
    startTime = Date.now()
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

      const durationSeconds = startTime > 0 ? Math.round((Date.now() - startTime) / 1000) : undefined
      await submitSurveyAnswers(slug, answers, respondentEmail, location, durationSeconds, fingerprintHash, selfie)
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
    questionErrors = {}

    if (!validateAnswer()) return
    if (!currentPage) return

    let next: string | null | 'END' = null
    for (const q of currentPage.questions) {
      const skipDest = evaluateNext(q.id, answers, questions, skipRules)
      if (skipDest) {
        next = skipDest
        break
      }
    }

    if (next === 'END') {
      await handleFinish()
      return
    }

    if (next !== null) {
      // Skip to specific question's page
      const targetPageIdx = surveyPages.findIndex(p => p.questions.some(q => q.id === next))
      if (targetPageIdx >= 0) {
        currentIndex = targetPageIdx
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    // Normal advance
    if (currentIndex < surveyPages.length - 1) {
      currentIndex += 1
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      await handleFinish()
    }
  }

  function handleBack() {
    validationError = null
    questionErrors = {}
    if (currentIndex > 0) {
      currentIndex -= 1
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // remove handleAnswer from here as we inline it

  const isLastQuestion = $derived(currentIndex === surveyPages.length - 1)
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
        <ProgressBar progress={progress} />
      {/if}

      <div class="content">
        {#if currentPage?.title}
          <SectionHeader
            title={currentPage.title}
            description={currentPage.description ?? null}
          />
        {/if}

        {#if currentPage}
          {#each currentPage.questions as q (q.id)}
            <QuestionCard
              question={q}
              questionNumber={settings.showNumbers ? getQuestionNumber(q, questions) : ''}
              answer={answers[q.id] ?? null}
              validationError={questionErrors[q.id] ?? null}
              onAnswer={(val) => {
                answers = { ...answers, [q.id]: val }
                if (questionErrors[q.id]) {
                  const newErrors = { ...questionErrors }
                  delete newErrors[q.id]
                  questionErrors = newErrors
                }
              }}
              {slug}
            />
          {/each}
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
