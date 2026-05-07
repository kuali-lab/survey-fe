<script lang="ts">
  import type { Question, AnswerValue } from '$lib/types.js'
  import QuestionInput from './QuestionInput.svelte'

  let {
    question,
    questionNumber,
    answer,
    validationError,
    onAnswer,
    slug = ''
  }: {
    question: Question
    questionNumber: string
    answer: AnswerValue
    validationError: string | null
    onAnswer: (value: AnswerValue) => void
    slug?: string
  } = $props()
</script>

<div class="card">
  {#if questionNumber}
    <div class="number-row">
      <span class="number">{questionNumber}</span>
      <svg class="number-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  {/if}

  <h2 class="question-title" data-question-heading tabindex="-1">
    <span class="title-text">{question.title}</span>
    {#if question.required}
      <span class="required" aria-label="wajib diisi">*</span>
    {/if}
  </h2>

  {#if question.description && question.type !== 'statement'}
    <p class="description">{question.description}</p>
  {/if}

  {#if question.imageUrl}
    {#if question.imageLayout === 'left' || question.imageLayout === 'right'}
      <div class="card-inline-wrap card-inline-{question.imageLayout}">
        <div class="inline-img-wrap">
          <img src={question.imageUrl} alt={question.title} class="inline-img" />
        </div>
        <div class="inline-input-wrap">
          <QuestionInput
            {question}
            value={answer}
            onChange={onAnswer}
            {slug}
          />
        </div>
      </div>
    {:else}
      <div class="image-wrap">
        <img src={question.imageUrl} alt={question.title} />
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
    color: var(--primary-60, #c89800);
    font-size: 14px;
    font-weight: 700;
    align-self: flex-start;
    letter-spacing: 0.02em;
  }

  .number {
    font-variant-numeric: tabular-nums;
  }

  .number-arrow {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .question-title {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
    outline: none;
  }

  .question-title:focus-visible {
    outline: 2px solid #f7bb00;
    outline-offset: 4px;
    border-radius: 4px;
  }

  .title-text {
    font-size: 22px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.3;
    flex: 1;
  }

  .required {
    color: var(--error-50);
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
  }

  .description {
    font-size: 15px;
    color: var(--tertiary-70, #5a5a55);
    line-height: 1.55;
    white-space: pre-wrap;
    margin: -4px 0 0;
  }

  .image-wrap {
    border-radius: var(--radius-md);
    overflow: hidden;
    max-height: 280px;
    background: var(--tertiary-10);
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
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--tertiary-10);
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
    color: var(--error-50);
    font-size: 13px;
    font-weight: 600;
  }

  /* Stack inline image on small screens */
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
      gap: 18px;
    }
    .title-text {
      font-size: 28px;
      line-height: 1.25;
    }
    .required {
      font-size: 28px;
    }
    .description {
      font-size: 16px;
    }
    .number-row {
      font-size: 15px;
    }
    .image-wrap {
      max-height: 320px;
    }
  }
</style>
