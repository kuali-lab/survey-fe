/**
 * SurveyRunner — Svelte 5 rune-based composable for the question flow.
 *
 * Extracted from src/routes/s/[slug]/+page.svelte so the surveyor interview
 * route can reuse the exact same pagination, validation, skip-rule, auto-
 * advance, and keyboard/wheel/touch behavior as the respondent flow.
 *
 * The runner owns question-flow state (answers, currentIndex, errors, timer).
 * The hosting page owns surrounding lifecycle (welcome, gates, submit, etc.)
 * and persistence (the page decides what/where to save).
 */

import type { Survey, Question, Answers, AnswerValue, SurveySettings } from '$lib/types.js'
import { getAnswerableQuestions } from '$lib/utils.js'
import { evaluateNext } from '$lib/skipLogic.js'
import { buildSurveySections, type SurveyPage } from './sections.js'

export type { SurveyPage }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isAnsweredValue(v: AnswerValue | undefined): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== '' && v !== '__uploading__'
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'object') {
    const c = v as { firstName?: string; lastName?: string; phone?: string; email?: string }
    return [c.firstName, c.lastName, c.phone, c.email].some((x) => typeof x === 'string' && x.trim() !== '')
  }
  return true
}

const AUTO_ADVANCE_TYPES = new Set([
  'single_choice', 'yes_no', 'image_choice', 'nps', 'rating', 'opinion_scale', 'dropdown',
])

const DEFAULT_SETTINGS: SurveySettings = {
  showProgress: true,
  showBranding: true,
  showNavArrows: true,
  showNumbers: true,
  displayMode: 'one_per_page',
}

export type RunnerOptions = {
  /**
   * Returns the current survey definition. Passed as a getter so reactive
   * `$derived` values in the caller (e.g. `data.survey`) flow through into
   * the runner's own $derived chains.
   */
  getSurvey: () => Survey | null
  /**
   * Called when "Selanjutnya" is pressed on the last page (or a skip rule
   * resolves to 'END'). The page decides what comes next — gates+submit for
   * respondent mode, navigate to /recap for surveyor mode.
   */
  onFinish: () => void | Promise<void>
  /**
   * Label for the action button on the last page. Defaults to "Kirim Jawaban".
   * Surveyor mode passes "Tinjau Jawaban" (it routes to /recap instead).
   */
  lastButtonLabel?: string
}

export class SurveyRunner {
  // ---- Reactive state ----
  answers = $state<Answers>({})
  currentIndex = $state(0)
  questionErrors = $state<Record<string, string>>({})
  autoAdvancing = $state(false)
  accumulatedTimeMs = $state(0)
  lastActiveTime = $state(0)
  // Navigation history stack: tracks the actual page indices the user
  // visited so that handleBack() can retrace skip-logic jumps correctly.
  private navHistory: number[] = []

  // ---- Private nav guards ----
  private autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null
  private lastNavTime = 0
  private touchStartY = 0
  private touchStartScrollY = 0

  private _getSurvey!: () => Survey | null
  private _onFinish!: () => void | Promise<void>
  private _lastButtonLabel!: string | undefined

  constructor(opts: RunnerOptions) {
    this._getSurvey = opts.getSurvey
    this._onFinish = opts.onFinish
    this._lastButtonLabel = opts.lastButtonLabel
  }

  /** Update the onFinish callback. Used by the surveyor flow where each
   *  route (/interview vs implicit nav from elsewhere) wants a different
   *  next step but the runner instance is shared. */
  setOnFinish(onFinish: () => void | Promise<void>) {
    this._onFinish = onFinish
  }

  // ---- Derived: survey shape ----
  private survey = $derived(this._getSurvey())
  private settings = $derived<SurveySettings>(this.survey?.settings ?? DEFAULT_SETTINGS)
  questions = $derived(this.survey?.questions ?? [])
  private skipRules = $derived(this.survey?.skipRules ?? [])
  answerableQuestions = $derived(getAnswerableQuestions(this.questions))

  // Skip logic requires per-page evaluation, so any active skip rule forces
  // one_per_page. Everything that branches on display mode — pagination, the
  // page's scroll-vs-paged render branch, nav handlers, progress, and auto-
  // advance — reads this single derived so they can never diverge. Scroll
  // layout is therefore used only when the survey has no skip rules.
  effectiveDisplayMode = $derived<'scroll' | 'one_per_page'>(
    this.skipRules.length > 0 ? 'one_per_page' : (this.settings.displayMode || 'one_per_page'),
  )
  isScrollMode = $derived(this.effectiveDisplayMode === 'scroll')

  // ---- Derived: pagination ----
  // one_per_page: each standalone question is its own page; each group is one
  // page (members inside). Ordered by sort_order so it matches the builder.
  surveyPages = $derived.by<SurveyPage[]>(() => {
    const questions = this.questions
    const answerable = this.answerableQuestions
    if (!answerable.length) return []

    // Skip-aware mode (see effectiveDisplayMode) — never trust the raw stored
    // display_mode here, or scroll layout could suppress skip-logic navigation.
    const mode = this.effectiveDisplayMode

    if (mode === 'scroll') {
      return [{ id: 'all', questions: answerable }]
    }
    // Flatten groups into per-question pages only when skip logic is live, so a
    // group never leaks skipped siblings/pre-target questions (audit Temuan F).
    // Non-skip one_per_page surveys keep their grouped pages unchanged.
    return buildSurveySections(questions, answerable, this.skipRules.length > 0)
  })

  currentPage = $derived(this.surveyPages[this.currentIndex] ?? null)

  // Scroll mode shows everything on one page but still renders group sections.
  scrollSections = $derived.by<SurveyPage[]>(() => {
    const questions = this.questions
    const answerable = this.answerableQuestions
    return buildSurveySections(questions, answerable)
  })

  // In scroll mode the survey is a single page, so page-ratio reports 100% on first render.
  // Instead, report the share of answerable questions that the respondent has filled.
  progress = $derived.by(() => {
    const total = this.answerableQuestions.length
    if (total === 0) return 0
    const mode = this.effectiveDisplayMode
    if (mode === 'scroll') {
      let answered = 0
      for (const q of this.answerableQuestions) {
        if (isAnsweredValue(this.answers[q.id])) answered++
      }
      return Math.round((answered / total) * 100)
    }
    return this.surveyPages.length > 0
      ? Math.round(((this.currentIndex + 1) / this.surveyPages.length) * 100)
      : 0
  })

  isLastQuestion = $derived(this.currentIndex === this.surveyPages.length - 1)

  nextButtonLabel = $derived(
    this.isLastQuestion ? (this._lastButtonLabel ?? 'Kirim Jawaban') : 'Selanjutnya',
  )

  // ---- Validation ----
  private validateOne(q: Question, answer: AnswerValue): string | null {
    if (q.required) {
      if (answer === null || answer === undefined) return 'Pertanyaan ini wajib diisi.'
      if (typeof answer === 'string' && answer.trim() === '') return 'Pertanyaan ini wajib diisi.'
      if (Array.isArray(answer) && answer.length === 0) return 'Pilih minimal satu jawaban.'
      if (q.type === 'contact_info') {
        const c = answer as { firstName?: string; lastName?: string; phone?: string; email?: string }
        const filled = [c.firstName, c.lastName, c.phone, c.email].some((v) => v && v.trim() !== '')
        if (!filled) return 'Isi minimal satu data kontak.'
      }
    }

    const isEmpty =
      answer === null ||
      answer === undefined ||
      (typeof answer === 'string' && answer.trim() === '') ||
      (Array.isArray(answer) && answer.length === 0)
    if (!q.required && isEmpty && q.type !== 'file_upload') return null

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

    if (q.type === 'email' && typeof answer === 'string' && answer.trim() !== '') {
      if (!EMAIL_RE.test(answer.trim())) return 'Format email belum sesuai.'
    }

    if (q.type === 'phone' && typeof answer === 'string' && answer.trim() !== '') {
      const digits = answer.replace(/\D/g, '')
      if (digits.length < 7 || digits.length > 15) return 'Format nomor telepon belum sesuai.'
    }

    if (q.type === 'file_upload' && typeof answer === 'string' && answer === '__uploading__') {
      return 'Tunggu hingga berkas selesai diunggah.'
    }

    return null
  }

  private validateCurrentPage(): boolean {
    if (!this.currentPage) return true
    const errors: Record<string, string> = {}
    for (const q of this.currentPage.questions) {
      const err = this.validateOne(q, this.answers[q.id])
      if (err) errors[q.id] = err
    }
    this.questionErrors = errors
    const isValid = Object.keys(errors).length === 0
    if (!isValid) {
      setTimeout(() => {
        const firstErrorEl = document.querySelector('.error')
        if (firstErrorEl) firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
    return isValid
  }

  // Inline blur validation. Empty + required is deferred to Selanjutnya;
  // format errors (email, phone, number range) surface on blur.
  handleBlur = (qid: string) => {
    const q = this.currentPage?.questions.find((x) => x.id === qid)
    if (!q) return
    const answer = this.answers[qid]
    const isEmpty =
      answer === null ||
      answer === undefined ||
      (typeof answer === 'string' && answer.trim() === '') ||
      (Array.isArray(answer) && answer.length === 0)
    if (isEmpty) return
    const err = this.validateOne(q, answer)
    if (err) {
      this.questionErrors = { ...this.questionErrors, [qid]: err }
    }
  }

  // ---- Navigation ----
  handleNext = async () => {
    this.cancelAutoAdvance()
    this.questionErrors = {}

    if (!this.validateCurrentPage()) return
    if (!this.currentPage) return

    // Push current page to navigation history before moving forward.
    this.navHistory.push(this.currentIndex)

    let next: string | null | 'END' = null
    for (const q of this.currentPage.questions) {
      const skipDest = evaluateNext(q.id, this.answers, this.questions, this.skipRules)
      if (skipDest) {
        next = skipDest
        break
      }
    }

    if (next === 'END') {
      await this._onFinish()
      return
    }

    if (next !== null) {
      const targetPageIdx = this.surveyPages.findIndex((p) => p.questions.some((q) => q.id === next))
      // Jump only FORWARD. The builder already restricts targets to order > host,
      // but the engine enforces it too (defense-in-depth, audit §4): a backward
      // or self jump from corrupt/stale data could loop forever, so it is
      // ignored and we fall through to the normal sequential advance below.
      // targetPageIdx === -1 (target deleted/not found) also falls through.
      if (targetPageIdx > this.currentIndex) {
        this.currentIndex = targetPageIdx
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    if (this.currentIndex < this.surveyPages.length - 1) {
      this.currentIndex += 1
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      await this._onFinish()
    }
  }

  handleBack = () => {
    this.cancelAutoAdvance()
    this.questionErrors = {}
    // When skip logic is active, use the navigation history to retrace the
    // actual path the user followed. Without skip rules, simple decrement
    // is sufficient (the two are equivalent in that case).
    if (this.navHistory.length > 0) {
      this.currentIndex = this.navHistory.pop()!
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (this.currentIndex > 0) {
      this.currentIndex -= 1
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  handleAnswer = (qid: string, value: AnswerValue) => {
    this.answers = { ...this.answers, [qid]: value }
    if (this.questionErrors[qid]) {
      const next = { ...this.questionErrors }
      delete next[qid]
      this.questionErrors = next
    }

    if (
      this.effectiveDisplayMode !== 'scroll' &&
      this.currentPage &&
      this.currentPage.questions.length === 1 &&
      this.currentPage.questions[0].id === qid
    ) {
      this.cancelAutoAdvance()
      if (this.shouldAutoAdvance(this.currentPage.questions[0], value)) {
        this.autoAdvancing = true
        this.autoAdvanceTimer = setTimeout(() => {
          this.autoAdvanceTimer = null
          this.autoAdvancing = false
          void this.handleNext()
        }, 400)
      }
    }
  }

  private shouldAutoAdvance(q: Question, v: AnswerValue): boolean {
    if (!AUTO_ADVANCE_TYPES.has(q.type)) return false
    if (v === null || v === undefined) return false
    if (typeof v === 'string' && v === '') return false

    // single-select with "Other": skip auto-advance when in the free-text branch
    if ((q.type === 'single_choice' || q.type === 'dropdown') && q.options) {
      const otherOpt = q.options.find((o) => o.isOther)
      if (otherOpt && typeof v === 'string') {
        const standardLabels = q.options.filter((o) => !o.isOther).map((o) => o.label)
        if (!standardLabels.includes(v)) return false
      }
    }
    return true
  }

  cancelAutoAdvance = () => {
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer)
      this.autoAdvanceTimer = null
    }
    this.autoAdvancing = false
  }

  // ---- Jump-to / reset (for recap, surveyor "next respondent") ----
  jumpTo = (qid: string) => {
    const idx = this.surveyPages.findIndex((p) => p.questions.some((q) => q.id === qid))
    if (idx >= 0) {
      this.cancelAutoAdvance()
      this.questionErrors = {}
      this.currentIndex = idx
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  reset = () => {
    this.cancelAutoAdvance()
    this.answers = {}
    this.currentIndex = 0
    this.questionErrors = {}
    this.navHistory = []
    this.accumulatedTimeMs = 0
    this.lastActiveTime = Date.now()
  }

  loadFrom = (state: { answers: Answers; currentIndex: number; accumulatedTimeMs?: number }) => {
    this.answers = state.answers
    const maxIdx = Math.max(0, this.surveyPages.length - 1)
    this.currentIndex = Math.min(state.currentIndex, maxIdx)
    this.accumulatedTimeMs = state.accumulatedTimeMs || 0
    this.lastActiveTime = Date.now()
  }

  getDurationSeconds = () => {
    let extra = 0
    if (this.lastActiveTime > 0) extra = Date.now() - this.lastActiveTime
    return Math.round((this.accumulatedTimeMs + extra) / 1000)
  }

  pauseTimer = () => {
    if (this.lastActiveTime > 0) {
      this.accumulatedTimeMs += Date.now() - this.lastActiveTime
      this.lastActiveTime = 0
    }
  }

  resumeTimer = () => {
    if (this.lastActiveTime === 0) {
      this.lastActiveTime = Date.now()
    }
  }

  // ---- Event handlers (wire via <svelte:window> when on the question stage) ----
  handleFocusIn = (e: FocusEvent) => {
    if (typeof window === 'undefined' || window.innerWidth >= 768) return
    const target = e.target as HTMLElement | null
    if (!target) return
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    if (!target.closest('.question-stage')) return
    setTimeout(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 250)
  }

  handleWheel = (e: WheelEvent) => {
    if (this.effectiveDisplayMode === 'scroll') return
    if (!this.currentPage) return
    if (this.autoAdvancing) return
    if (Date.now() - this.lastNavTime < 700) return

    const sy = window.scrollY
    const sh = document.documentElement.scrollHeight
    const vh = window.innerHeight

    if (e.deltaY < -30 && sy <= 0 && this.currentIndex > 0) {
      this.lastNavTime = Date.now()
      this.handleBack()
    } else if (e.deltaY > 30 && sy + vh >= sh - 2 && !this.isLastQuestion) {
      this.lastNavTime = Date.now()
      void this.handleNext()
    }
  }

  handleTouchStart = (e: TouchEvent) => {
    this.touchStartY = e.touches[0]?.clientY ?? 0
    this.touchStartScrollY = window.scrollY
  }

  handleTouchEnd = (e: TouchEvent) => {
    if (this.effectiveDisplayMode === 'scroll') return
    if (!this.currentPage) return
    if (this.autoAdvancing) return
    if (Date.now() - this.lastNavTime < 700) return

    const endY = e.changedTouches[0]?.clientY ?? 0
    const deltaY = endY - this.touchStartY
    const sy = window.scrollY
    const sh = document.documentElement.scrollHeight
    const vh = window.innerHeight

    if (deltaY > 80 && this.touchStartScrollY <= 0 && sy <= 0 && this.currentIndex > 0) {
      this.lastNavTime = Date.now()
      this.handleBack()
    } else if (
      deltaY < -80 &&
      this.touchStartScrollY + vh >= sh - 2 &&
      sy + vh >= sh - 2 &&
      !this.isLastQuestion
    ) {
      this.lastNavTime = Date.now()
      void this.handleNext()
    }
  }

  handleKeydown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const tag = target.tagName
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
    if (target.isContentEditable) return

    if (this.effectiveDisplayMode !== 'scroll') {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (this.currentIndex > 0) {
          e.preventDefault()
          this.handleBack()
        }
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (!this.isLastQuestion) {
          e.preventDefault()
          void this.handleNext()
        }
        return
      }
    }

    if (this.effectiveDisplayMode === 'scroll') return
    if (!this.currentPage || this.currentPage.questions.length !== 1) return

    if (e.key === 'Enter') {
      if (tag === 'BUTTON') return
      e.preventDefault()
      void this.handleNext()
      return
    }

    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key.length !== 1) return
    const key = e.key.toUpperCase()
    const q = this.currentPage.questions[0]

    if (q.type === 'yes_no') {
      if (key === 'Y') {
        e.preventDefault()
        this.handleAnswer(q.id, 'yes')
        return
      }
      if (key === 'T' || key === 'N') {
        e.preventDefault()
        this.handleAnswer(q.id, 'no')
        return
      }
      return
    }

    if (q.type === 'single_choice' || q.type === 'checkbox' || q.type === 'image_choice') {
      if (!q.options) return
      const standard = q.options.filter((o) => !o.isOther)
      const other = q.options.find((o) => o.isOther)
      const opts = other ? [...standard, other] : standard
      const idx = key.charCodeAt(0) - 65
      if (idx < 0 || idx >= opts.length) return
      const opt = opts[idx]
      e.preventDefault()

      if (q.type === 'checkbox') {
        const current = Array.isArray(this.answers[q.id]) ? [...(this.answers[q.id] as string[])] : []
        const existingIdx = current.indexOf(opt.label)
        if (existingIdx >= 0) current.splice(existingIdx, 1)
        else current.push(opt.label)
        this.handleAnswer(q.id, current)
      } else {
        this.handleAnswer(q.id, opt.label)
      }
    }
  }
}
