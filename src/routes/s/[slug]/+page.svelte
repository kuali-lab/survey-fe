<script lang="ts">
  import type { PageData } from './$types.js'
  import type { ViewState, Answers, AnswerValue, Question } from '$lib/types.js'
  import { submitSurveyAnswers } from '$lib/api.js'
  import { getAnswerableQuestions, getQuestionNumber } from '$lib/utils.js'
  import { evaluateNext } from '$lib/skipLogic.js'

  import ProgressBar from '$lib/components/ProgressBar.svelte'
  import SectionHeader from '$lib/components/SectionHeader.svelte'
  import WelcomePage from '$lib/components/WelcomePage.svelte'
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
    if (!survey || data.error) return 'error'
    if (survey.status === 'closed') return 'closed'
    if (survey.status !== 'active') return 'error'
    return 'welcome'
  }

  let viewState = $state<ViewState>(getInitialViewState())
  let answers = $state<Answers>({})
  let currentIndex = $state(0)
  let validationError = $state<string | null>(null)
  let submitting = $state(false)
  let submitError = $state<string | null>(null)

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
    if (!currentQuestion.required) return true

    const answer = answers[currentQuestion.id]

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

    return true
  }

  function handleStart() {
    viewState = 'question'
    currentIndex = 0
  }

  async function handleSubmit() {
    submitting = true
    submitError = null
    viewState = 'submitting'

    try {
      // Collect respondent email if there's an email question
      const emailQuestion = answerableQuestions.find(q => q.type === 'email')
      const respondentEmail = emailQuestion ? (answers[emailQuestion.id] as string | undefined) : undefined

      await submitSurveyAnswers(slug, answers, respondentEmail)
      viewState = 'closing'
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'submit_error'
      if (msg === 'already_submitted') {
        submitError = 'Survei ini sudah pernah Anda isi sebelumnya.'
      } else if (msg === 'survey_closed') {
        submitError = 'Maaf, survei ini sudah ditutup.'
      } else {
        submitError = 'Terjadi kesalahan saat mengirim jawaban. Silakan coba lagi.'
      }
      viewState = 'question'
    } finally {
      submitting = false
    }
  }

  async function handleNext() {
    validationError = null

    if (!validateAnswer()) return

    if (!currentQuestion) return

    // Evaluate skip logic
    const next = evaluateNext(currentQuestion.id, answers, questions, skipRules)

    if (next === 'END') {
      await handleSubmit()
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
      await handleSubmit()
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
</script>

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
        title={survey?.title ?? ''}
        description={welcomeQuestion?.description ?? null}
        imageUrl={welcomeQuestion?.imageUrl ?? null}
        ctaText={String(welcomeQuestion?.config?.buttonText ?? 'Mulai Survei')}
        onStart={handleStart}
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
          <QuestionCard
            question={currentQuestion}
            questionNumber={settings.showNumbers ? questionNumber : ''}
            answer={answers[currentQuestion.id] ?? null}
            validationError={validationError}
            onAnswer={handleAnswer}
          />
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
    align-items: center;
    justify-content: center;
    padding: 16px;
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
