<script lang="ts">
  import type { Question, AnswerValue } from '$lib/types.js'
  import QuestionInput from './QuestionInput.svelte'

  let {
    question,
    questionNumber,
    answer,
    validationError,
    onAnswer,
    onBlur,
    slug = ''
  }: {
    question: Question
    questionNumber: string
    answer: AnswerValue
    validationError: string | null
    onAnswer: (value: AnswerValue) => void
    onBlur?: () => void
    slug?: string
  } = $props()
</script>

<div class="card">
  {#if questionNumber}
    <div class="number-row">
      <span class="number">{questionNumber}</span>
      <svg class="number-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  {/if}

  <h2 class="question-title" data-question-heading tabindex="-1">
    <div class="title-text">{@html question.title}</div>
    {#if question.required}
      <span class="required" aria-label="wajib diisi">*</span>
    {/if}
  </h2>

  {#if question.description && question.type !== 'statement'}
    <div class="description">{@html question.description}</div>
  {/if}

  {#if question.imageUrl}
    {#if question.imageLayout === 'left' || question.imageLayout === 'right'}
      <div class="card-inline-wrap card-inline-{question.imageLayout}">
        <div class="inline-img-wrap">
          <img src={question.imageUrl} alt={question.titlePlain ?? ''} class="inline-img" />
        </div>
        <div class="inline-input-wrap">
          <QuestionInput
            {question}
            value={answer}
            onChange={onAnswer}
            {onBlur}
            {slug}
          />
        </div>
      </div>
    {:else}
      <div class="image-wrap">
        <img src={question.imageUrl} alt={question.titlePlain ?? ''} />
      </div>
      <div class="input-wrap">
        <QuestionInput
          {question}
          value={answer}
          onChange={onAnswer}
          {slug}
        />
      </div>
    {/if}
  {:else}
    <div class="input-wrap">
      <QuestionInput
        {question}
        value={answer}
        onChange={onAnswer}
        {slug}
      />
    </div>
  {/if}

  {#if validationError}
    <div class="error" role="alert">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <path d="M12 8v5M12 16v.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      {validationError}
    </div>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .number-row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text-body);
    font-size: 14px;
    font-weight: 500;
    align-self: flex-start;
    letter-spacing: 0;
  }

  .number {
    font-variant-numeric: tabular-nums;
  }

  .number-arrow {
    flex-shrink: 0;
    color: var(--ink);
    margin-top: 1px;
  }

  .question-title {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
    outline: none;
  }

  /* Programmatic focus is announced by AT; no visible ring needed and the
     yellow box around every question title reads as a UI bug. */
  .question-title:focus-visible {
    outline: none;
  }

  /* Survey questions read more naturally in the body face at semibold —
     headlines feel announcement-y for what is meant to be a conversation. */
  .title-text {
    flex: 1;
    font-family: var(--font);
    font-size: 19px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 26px;
    letter-spacing: 0;
  }

  /* Rich-text formatting from builder's RichTextEditor (b/i/u and alignment).
     :global is needed because the tags are injected via {@html} at runtime and
     Svelte's scoped CSS would otherwise ignore them. */
  .title-text :global(b),
  .title-text :global(strong) { font-weight: 700; }
  .title-text :global(i),
  .title-text :global(em) { font-style: italic; }
  .title-text :global(u) { text-decoration: underline; }
  .title-text :global(div) { /* alignment divs from execCommand */ width: 100%; }

  .description :global(b),
  .description :global(strong) { font-weight: 700; }
  .description :global(i),
  .description :global(em) { font-style: italic; }
  .description :global(u) { text-decoration: underline; }

  .required {
    color: var(--error);
    font-size: 19px;
    line-height: 1;
    flex-shrink: 0;
  }

  .description {
    font-size: 16px;
    color: var(--text-body);
    line-height: 24px;
    white-space: pre-wrap;
    margin: -4px 0 0;
  }

  .image-wrap {
    border-radius: var(--radius-card);
    overflow: hidden;
    max-height: 280px;
    background: var(--canvas-soft);
  }

  .image-wrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .input-wrap {
    margin-top: 6px;
  }

  /* Inline image layout (left / right) */
  .card-inline-wrap {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }
  .card-inline-left { flex-direction: row; }
  .card-inline-right { flex-direction: row-reverse; }

  .inline-img-wrap {
    flex: 0 0 140px;
    border-radius: var(--radius-card);
    overflow: hidden;
    background: var(--canvas-soft);
  }

  .inline-img {
    width: 140px;
    height: 140px;
    object-fit: contain;
    display: block;
  }

  .inline-input-wrap {
    flex: 1;
    min-width: 0;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--error);
    font-size: 13px;
    font-weight: 500;
  }

  @media (max-width: 480px) {
    .card-inline-wrap {
      flex-direction: column;
    }
    .inline-img-wrap,
    .inline-img {
      width: 100%;
      flex: 0 0 auto;
      height: auto;
      max-height: 200px;
    }
    .inline-img {
      object-fit: contain;
    }
  }

  @media (min-width: 768px) {
    .card {
      gap: 16px;
    }
    .title-text {
      font-size: 21px;
      line-height: 28px;
    }
    .required {
      font-size: 21px;
    }
    .number-row {
      font-size: 14px;
    }
    .image-wrap {
      max-height: 320px;
    }
  }
</style>
