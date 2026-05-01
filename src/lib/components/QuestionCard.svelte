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
    <span class="number">#{questionNumber}</span>
  {/if}

  <div class="question-title">
    <span class="title-text">{question.title}</span>
    {#if question.required}
      <span class="required" aria-label="wajib diisi">*</span>
    {/if}
  </div>

  {#if question.description && question.type !== 'statement'}
    <p class="description">{question.description}</p>
  {/if}

  {#if question.imageUrl}
    {#if question.imageLayout === 'left' || question.imageLayout === 'right'}
      <!-- Inline layout: image beside content -->
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
      <!-- Top layout (default) -->
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
    background: white;
    border-radius: var(--radius-lg);
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  }

  .number {
    display: inline-block;
    font-size: 13px;
    font-weight: 600;
    color: var(--tertiary-60);
    background: var(--tertiary-20);
    border-radius: var(--radius-xl);
    padding: 3px 10px;
    align-self: flex-start;
  }

  .question-title {
    display: flex;
    align-items: flex-start;
    gap: 4px;
  }

  .title-text {
    font-size: 18px;
    font-weight: 600;
    color: var(--tertiary-100);
    line-height: 1.4;
    flex: 1;
  }

  .required {
    color: var(--error-50);
    font-size: 20px;
    line-height: 1;
    flex-shrink: 0;
  }

  .description {
    font-size: 14px;
    color: var(--tertiary-60);
    line-height: 1.5;
    white-space: pre-wrap;
    margin-top: -4px;
  }

  .image-wrap {
    border-radius: var(--radius-md);
    overflow: hidden;
    max-height: 320px;
  }

  .image-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .input-wrap {
    margin-top: 4px;
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
    flex: 0 0 160px;
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .inline-img {
    width: 160px;
    height: 160px;
    object-fit: cover;
    display: block;
  }

  .inline-input-wrap {
    flex: 1;
  }

  .error {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--error-50);
    font-size: 13px;
    font-weight: 600;
  }
</style>
