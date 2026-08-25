<!--
  Panggung survei: bilah kemajuan, pertanyaan, dan tombol navigasinya.

  🔴 Diekstrak dari `routes/s/[slug]/+page.svelte` supaya PRATINJAU dan
  RESPONDEN memakai perender yang sama persis. Sebelum ini blok ini hidup di
  dalam halaman responden; menyalinnya ke halaman pratinjau berarti dua perender
  untuk satu bentuk, dan yang kedua menyimpang — cukup pelan sehingga tidak ada
  yang sadar sampai seorang responden menabraknya, dan saat itu justru bagian
  yang "sudah dilihat di pratinjau" yang salah.

  Yang SENGAJA tidak ikut: pengiriman. Dialog konfirmasi kirim, penyimpanan
  draf, dan undangan tetap tinggal di halaman responden — panggung ini cuma
  merender dan memancarkan, dan `runner` yang memutuskan apa yang terjadi
  sesudah pertanyaan terakhir.
-->
<script lang="ts">
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import type { SurveyRunner } from '$lib/runner/SurveyRunner.svelte.js'
  import { getQuestionNumber } from '$lib/utils.js'
  import ProgressBar from './ProgressBar.svelte'
  import SectionHeader from './SectionHeader.svelte'
  import QuestionCard from './QuestionCard.svelte'
  import NavButton from './NavButton.svelte'

  let {
    runner,
    settings,
    questionErrors = {},
    slug = '',
    submitError = null,
    submitting = false,
    prefersReducedMotion = false,
    // Pratinjau: unggah berkas dimatikan DI SINI, bukan dibiarkan gagal sendiri.
    // Draf tidak punya slug, jadi unggahan akan menembak `/s//upload` — sebuah
    // permintaan keluar dari halaman yang seharusnya nol pengiriman.
    pratinjau = false,
  }: {
    runner: SurveyRunner
    settings: { showProgress?: boolean; showNumbers?: boolean; showNavArrows?: boolean }
    questionErrors?: Record<string, string>
    slug?: string
    submitError?: string | null
    submitting?: boolean
    prefersReducedMotion?: boolean
    pratinjau?: boolean
  } = $props()
</script>

<div class="survey-wrap">
  {#if settings.showProgress}
    <ProgressBar progress={runner.progress} />
  {/if}

  <main class="content">
    <div
      class="question-stage"
      class:single-question={runner.currentPage?.questions.length === 1 && !runner.isScrollMode}
    >
      {#if runner.isScrollMode}
        <!-- Scroll mode: render every group as its own section so the
             respondent view matches the builder (groups don't disappear). -->
        {#each runner.scrollSections as section (section.id)}
          <div class="stage-slide">
            {#if section.title}
              <SectionHeader title={section.title} description={section.description ?? null} />
            {/if}
            {#each section.questions as q (q.id)}
              <QuestionCard
                question={q}
                questionNumber={settings.showNumbers ? getQuestionNumber(q, runner.questions) : ''}
                answer={runner.answers[q.id] ?? null}
                validationError={questionErrors[q.id] ?? null}
                onAnswer={(val) => runner.handleAnswer(q.id, val)}
                onBlur={() => runner.handleBlur(q.id)}
                {slug}
                {pratinjau}
              />
            {/each}
          </div>
        {/each}
      {:else if runner.currentPage}
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
                {pratinjau}
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

<style>
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
    /* Outer gap between scroll-mode section blocks. Without card chrome the
       questions are visually flat; a moderate gap keeps grouping legible
       without making the page feel sparse. In one_per_page mode there's only
       one .stage-slide child so the gap is inert. */
    gap: 32px;
  }

  /* On desktop, vertically center the single question for a Typeform-like
     focus. On mobile, top-anchor — centering creates a floating-in-space feel
     because the viewport is tall and the question alone can't fill it. */
  @media (min-width: 768px) {
    .question-stage.single-question {
      justify-content: center;
    }
  }

  .stage-slide {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .question-stage:not(.single-question) .stage-slide {
    /* Inner gap between questions within a single section. */
    gap: 24px;
  }

  @media (min-width: 768px) {
    .question-stage {
      gap: 40px;
    }

    .content {
      padding: 16px 24px 24px;
    }

    .stage-slide {
      gap: 20px;
    }
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

  .submit-error {
    background: var(--error-bg);
    border: 1px solid var(--error-border);
    border-radius: var(--radius-input);
    color: var(--error);
    padding: 12px 16px;
    font-size: 14px;
    margin-top: 8px;
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
</style>
