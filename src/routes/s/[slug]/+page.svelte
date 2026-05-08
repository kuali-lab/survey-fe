<script lang="ts">
  import type { PageData } from './$types.js'
  import type { ViewState, Answers, AnswerValue, Question } from '$lib/types.js'
  import { submitSurveyAnswers } from '$lib/api.js'
  import { computeFingerprint } from '$lib/fingerprint.js'
  import { getAnswerableQuestions, getQuestionNumber } from '$lib/utils.js'
  import { evaluateNext } from '$lib/skipLogic.js'
  import { page } from '$app/stores'
  import { onMount, tick } from 'svelte'
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
  let prefersReducedMotion = $state(false)
  let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null
  let autoAdvancing = $state(false)
  let lastNavTime = 0
  let touchStartY = 0
  let touchStartScrollY = 0
  let resumePrompt = $state<{ answers: Answers; currentIndex: number; startTime: number } | null>(null)

  // Persisted respondent state, keyed per survey slug. Selfie image and
  // location are intentionally NOT persisted (privacy + size).
  type SavedState = {
    answers: Answers
    currentIndex: number
    startTime: number
    savedAt: number
  }
  const STORAGE_TTL_MS = 30 * 24 * 3600 * 1000 // 30 days
  const storageKey = (s: string) => `survey-fe:state:${s}`

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
      return parsed as SavedState
    } catch {
      return null
    }
  }

  function saveCurrentState() {
    if (typeof localStorage === 'undefined') return
    if (!data.slug) return
    if (Object.keys(answers).length === 0) return
    try {
      const state: SavedState = {
        answers,
        currentIndex,
        startTime,
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
    answers = resumePrompt.answers
    // Clamp in case the survey was edited (questions removed) since save.
    const maxIdx = Math.max(0, surveyPages.length - 1)
    currentIndex = Math.min(resumePrompt.currentIndex, maxIdx)
    startTime = resumePrompt.startTime || Date.now()
    resumePrompt = null
    viewState = 'question'
  }

  function discardSavedState() {
    clearSavedState()
    resumePrompt = null
  }

  onMount(() => {
    computeFingerprint().then(fp => { fingerprintHash = fp })

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

  // Auto-save on every answer/index change while in the question view.
  $effect(() => {
    void answers
    void currentIndex
    if (viewState !== 'question') return
    saveCurrentState()
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
    const nonGroupQs = answerableQuestions.filter(q => !q.groupId)
    if (nonGroupQs.length > 0) {
      pages.push({ id: 'non-group', questions: nonGroupQs })
    }

    const groupQs = questions.filter(q => q.type === 'question_group')
    for (const g of groupQs) {
      const qInGroup = answerableQuestions.filter(q => q.groupId === g.id)
      if (qInGroup.length > 0) {
        pages.push({
          id: g.id,
          title: g.title,
          description: g.description,
          questions: qInGroup
        })
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

  // Loose RFC-5321-style email check. Strict enough to catch typos like
  // "foo@" or "foo.com" but doesn't try to validate every edge case the spec
  // technically permits — server is the source of truth for delivery.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  function validateOne(q: Question, answer: AnswerValue): string | null {
    // 1. Required check
    if (q.required) {
      if (answer === null || answer === undefined) return 'Pertanyaan ini wajib diisi.'
      if (typeof answer === 'string' && answer.trim() === '') return 'Pertanyaan ini wajib diisi.'
      if (Array.isArray(answer) && answer.length === 0) return 'Pilih minimal satu jawaban.'
      if (q.type === 'contact_info') {
        const c = answer as { firstName?: string; lastName?: string; phone?: string; email?: string }
        const filled = [c.firstName, c.lastName, c.phone, c.email].some(v => v && v.trim() !== '')
        if (!filled) return 'Isi minimal satu data kontak.'
      }
    }

    // 2. Empty + optional → ok (file_upload still needs to check upload state below)
    const isEmpty = answer === null || answer === undefined ||
      (typeof answer === 'string' && answer.trim() === '') ||
      (Array.isArray(answer) && answer.length === 0)
    if (!q.required && isEmpty && q.type !== 'file_upload') return null

    // 3. Number range
    if (q.type === 'number') {
      let answerNum: unknown = answer
      if (typeof answer === 'string' && answer.trim() !== '') answerNum = Number(answer)
      if (typeof answerNum === 'number' && !isNaN(answerNum)) {
        const minVal = q.minValue !== undefined && q.minValue !== null ? Number(q.minValue) : null
        const maxVal = q.maxValue !== undefined && q.maxValue !== null ? Number(q.maxValue) : null
        if (minVal !== null && answerNum < minVal) return `Nilai minimal adalah ${minVal}.`
        if (maxVal !== null && answerNum > maxVal) return `Nilai maksimal adalah ${maxVal}.`
      }
    }

    // 4. Email format
    if (q.type === 'email' && typeof answer === 'string' && answer.trim() !== '') {
      if (!EMAIL_RE.test(answer.trim())) return 'Format email belum sesuai.'
    }

    // 5. Phone format — accept digits, +, spaces, dashes, parens; require 7-15 digits
    if (q.type === 'phone' && typeof answer === 'string' && answer.trim() !== '') {
      const digits = answer.replace(/\D/g, '')
      if (digits.length < 7 || digits.length > 15) return 'Format nomor telepon belum sesuai.'
    }

    // 6. File upload still in progress
    if (q.type === 'file_upload' && typeof answer === 'string' && answer === '__uploading__') {
      return 'Tunggu hingga berkas selesai diunggah.'
    }

    return null
  }

  function validateAnswer(): boolean {
    if (!currentPage) return true

    const errors: Record<string, string> = {}
    for (const q of currentPage.questions) {
      const err = validateOne(q, answers[q.id])
      if (err) errors[q.id] = err
    }
    questionErrors = errors

    const isValid = Object.keys(errors).length === 0
    if (!isValid) {
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.error')
        if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
    return isValid
  }

  // Inline blur validation. Skipped when the answer is empty so that a
  // first tab-out of an untouched required field does not immediately
  // shout "wajib diisi" — that error still surfaces on Selanjutnya click.
  // Format errors (email, phone, number range) DO surface on blur.
  function handleBlur(qid: string) {
    const q = currentPage?.questions.find(x => x.id === qid)
    if (!q) return
    const answer = answers[qid]
    const isEmpty = answer === null || answer === undefined ||
      (typeof answer === 'string' && answer.trim() === '') ||
      (Array.isArray(answer) && answer.length === 0)
    if (isEmpty) return

    const err = validateOne(q, answer)
    if (err) {
      questionErrors = { ...questionErrors, [qid]: err }
    }
  }


  async function handleStart() {
    validationError = null
    startTime = Date.now()
    viewState = 'question'
    currentIndex = 0
    // Explicit fresh start — discard any stale resume state.
    answers = {}
    clearSavedState()
    resumePrompt = null
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
      // Collect respondent email if there's an email question
      const emailQuestion = answerableQuestions.find(q => q.type === 'email')
      const respondentEmail = emailQuestion ? (answers[emailQuestion.id] as string | undefined) : undefined

      const durationSeconds = startTime > 0 ? Math.round((Date.now() - startTime) / 1000) : undefined
      await submitSurveyAnswers(slug, answers, respondentEmail, location, durationSeconds, fingerprintHash, selfie)
      viewState = 'closing'
      clearSavedState()
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
    clearAutoAdvance()
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
    clearAutoAdvance()
    validationError = null
    questionErrors = {}
    if (currentIndex > 0) {
      currentIndex -= 1
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleAnswer(qid: string, value: AnswerValue) {
    answers = { ...answers, [qid]: value }
    if (questionErrors[qid]) {
      const newErrors = { ...questionErrors }
      delete newErrors[qid]
      questionErrors = newErrors
    }
    validationError = null

    // Auto-advance fires only on single-question pages in one_per_page mode.
    // Multi-question groups and scroll mode would jump away while the user
    // might still be answering sibling questions.
    if (
      settings.displayMode !== 'scroll' &&
      currentPage &&
      currentPage.questions.length === 1 &&
      currentPage.questions[0].id === qid
    ) {
      clearAutoAdvance()
      if (shouldAutoAdvance(currentPage.questions[0], value)) {
        autoAdvancing = true
        autoAdvanceTimer = setTimeout(() => {
          autoAdvanceTimer = null
          autoAdvancing = false
          handleNext()
        }, 400)
      }
    }
  }

  function clearAutoAdvance() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer)
      autoAdvanceTimer = null
    }
    autoAdvancing = false
  }

  // Single-tap question types where the answer is final on selection.
  // Excluded: checkbox (multi), text inputs, matrix, contact_info, file_upload, number (range validation).
  const AUTO_ADVANCE_TYPES = new Set([
    'single_choice', 'yes_no', 'image_choice', 'nps', 'rating', 'opinion_scale', 'dropdown'
  ])

  function shouldAutoAdvance(q: Question, v: AnswerValue): boolean {
    if (!AUTO_ADVANCE_TYPES.has(q.type)) return false
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v === '') return false

    // For single-select with "Other" option: skip auto-advance when user is in
    // the free-text branch — they still need to type.
    if ((q.type === 'single_choice' || q.type === 'dropdown') && q.options) {
      const otherOpt = q.options.find(o => o.isOther)
      if (otherOpt && typeof v === 'string') {
        const standardLabels = q.options.filter(o => !o.isOther).map(o => o.label)
        if (!standardLabels.includes(v)) return false
      }
    }
    return true
  }

  // Scroll the focused input toward the viewport center on small screens so
  // the soft keyboard doesn't cover it. Defer briefly to let the keyboard
  // animate up first; without the delay the scroll happens before the
  // visual viewport shrinks and the input ends up hidden again.
  function handleFocusIn(e: FocusEvent) {
    if (viewState !== 'question') return
    if (typeof window === 'undefined' || window.innerWidth >= 768) return
    const target = e.target as HTMLElement | null
    if (!target) return
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    if (!target.closest('.question-stage')) return
    setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 250)
  }

  // Wheel-based navigation. At the very top of the page, scrolling up jumps
  // back; at the very bottom, scrolling down jumps forward. Inside content
  // taller than the viewport (e.g. mobile matrix), normal scrolling still
  // works — the browser scrolls until it hits the boundary, then a further
  // wheel tick triggers navigation.
  function handleWheel(e: WheelEvent) {
    if (viewState !== 'question') return
    if (settings.displayMode === 'scroll') return
    if (!currentPage) return
    if (autoAdvancing || submitting) return
    if (Date.now() - lastNavTime < 700) return

    const sy = window.scrollY
    const sh = document.documentElement.scrollHeight
    const vh = window.innerHeight

    if (e.deltaY < -30 && sy <= 0 && currentIndex > 0) {
      lastNavTime = Date.now()
      handleBack()
    } else if (e.deltaY > 30 && sy + vh >= sh - 2 && !isLastQuestion) {
      lastNavTime = Date.now()
      handleNext()
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (viewState !== 'question') return
    touchStartY = e.touches[0]?.clientY ?? 0
    touchStartScrollY = window.scrollY
  }

  // Mobile swipe: at scroll-top a downward swipe goes back; at scroll-bottom
  // an upward swipe advances. The 80 px threshold filters incidental motion.
  function handleTouchEnd(e: TouchEvent) {
    if (viewState !== 'question') return
    if (settings.displayMode === 'scroll') return
    if (!currentPage) return
    if (autoAdvancing || submitting) return
    if (Date.now() - lastNavTime < 700) return

    const endY = e.changedTouches[0]?.clientY ?? 0
    const deltaY = endY - touchStartY
    const sy = window.scrollY
    const sh = document.documentElement.scrollHeight
    const vh = window.innerHeight

    if (deltaY > 80 && touchStartScrollY <= 0 && sy <= 0 && currentIndex > 0) {
      lastNavTime = Date.now()
      handleBack()
    } else if (deltaY < -80 && touchStartScrollY + vh >= sh - 2 && sy + vh >= sh - 2 && !isLastQuestion) {
      lastNavTime = Date.now()
      handleNext()
    }
  }

  // Keyboard handling: ArrowUp/Down (any page) and Enter/letters (single-q
  // pages only). Multi-question groups don't get hijacked by Enter/letters.
  function handleKeydown(e: KeyboardEvent) {
    if (viewState !== 'question') return
    if (submitting) return

    const target = e.target as HTMLElement | null
    if (!target) return
    const tag = target.tagName
    if (tag === 'TEXTAREA') return
    if (tag === 'INPUT') return
    if (tag === 'SELECT') return
    if (target.isContentEditable) return

    // Arrow / PageUp-Down work in any one_per_page configuration so users can
    // page through groups too. Disabled in scroll mode (browser owns scroll).
    if (settings.displayMode !== 'scroll') {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (currentIndex > 0) {
          e.preventDefault()
          handleBack()
        }
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (!isLastQuestion) {
          e.preventDefault()
          handleNext()
        }
        return
      }
    }

    // Enter/letter shortcuts gate to one_per_page + single question.
    if (settings.displayMode === 'scroll') return
    if (!currentPage || currentPage.questions.length !== 1) return

    if (e.key === 'Enter') {
      if (tag === 'BUTTON') return // let native button activation run
      e.preventDefault()
      handleNext()
      return
    }

    // Letter shortcuts. Modifier-aware so Cmd+R, Ctrl+L etc. still work.
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key.length !== 1) return
    const key = e.key.toUpperCase()
    const q = currentPage.questions[0]

    if (q.type === 'yes_no') {
      if (key === 'Y') { e.preventDefault(); handleAnswer(q.id, 'yes'); return }
      if (key === 'T' || key === 'N') { e.preventDefault(); handleAnswer(q.id, 'no'); return }
      return
    }

    if (q.type === 'single_choice' || q.type === 'checkbox' || q.type === 'image_choice') {
      if (!q.options) return
      const standard = q.options.filter(o => !o.isOther)
      const other = q.options.find(o => o.isOther)
      const opts = other ? [...standard, other] : standard
      const idx = key.charCodeAt(0) - 65
      if (idx < 0 || idx >= opts.length) return
      const opt = opts[idx]
      e.preventDefault()

      if (q.type === 'checkbox') {
        const current = Array.isArray(answers[q.id]) ? [...(answers[q.id] as string[])] : []
        const existingIdx = current.indexOf(opt.label)
        if (existingIdx >= 0) current.splice(existingIdx, 1)
        else current.push(opt.label)
        handleAnswer(q.id, current)
      } else {
        handleAnswer(q.id, opt.label)
      }
    }
  }

  // Focus the first input on each new page. For input-less types
  // (choice / rating / etc), focus the first question heading so screen
  // readers announce it and Enter-to-advance works without prior tabbing.
  $effect(() => {
    const id = currentPage?.id
    if (viewState !== 'question' || !id) return
    void id
    void tick().then(() => {
      const stage = document.querySelector('.question-stage')
      if (!stage) return
      const inputTypes = new Set([
        'short_text', 'long_text', 'email', 'phone', 'website',
        'number', 'date', 'contact_info'
      ])
      const firstQ = currentPage?.questions[0]
      if (firstQ && inputTypes.has(firstQ.type)) {
        const input = stage.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
        input?.focus({ preventScroll: true })
      } else {
        const heading = stage.querySelector<HTMLElement>('[data-question-heading]')
        heading?.focus({ preventScroll: true })
      }
    })
  })

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

<svelte:window
  onkeydown={handleKeydown}
  onfocusin={handleFocusIn}
  onwheel={handleWheel}
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
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
        <ProgressBar progress={progress} />
      {/if}

      <main class="content">
        <div
          class="question-stage"
          class:single-question={currentPage?.questions.length === 1 && settings.displayMode !== 'scroll'}
        >
          {#if currentPage}
            {#key currentPage.id}
              <div
                class="stage-slide"
                in:fly={{ y: prefersReducedMotion ? 0 : 16, duration: prefersReducedMotion ? 0 : 220, easing: cubicOut }}
              >
                {#if currentPage.title}
                  <SectionHeader
                    title={currentPage.title}
                    description={currentPage.description ?? null}
                  />
                {/if}
                {#each currentPage.questions as q (q.id)}
                  <QuestionCard
                    question={q}
                    questionNumber={settings.showNumbers ? getQuestionNumber(q, questions) : ''}
                    answer={answers[q.id] ?? null}
                    validationError={questionErrors[q.id] ?? null}
                    onAnswer={(val) => handleAnswer(q.id, val)}
                    onBlur={() => handleBlur(q.id)}
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

        {#if autoAdvancing}
          <div class="auto-advance-hint" aria-live="polite">
            <span class="auto-advance-spinner" aria-hidden="true"></span>
            Lanjut otomatis…
          </div>
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

  /* Vertical-center only when a single question owns the page (one_per_page).
     Multi-question groups and scroll mode stack from the top so all cards
     are reachable without compressed centering. */
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

  /* Mobile: pin the action bar to the viewport bottom so it stays reachable
     in scroll mode and on long matrix pages. Falls back to inline behavior
     when content fits, since position: sticky is a no-op without scroll. */
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

  /* Visible cue while the auto-advance timer is counting down so users
     understand why the next screen is about to appear. */
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

  /* Resume prompt — shown on welcome state when localStorage has saved answers */
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
