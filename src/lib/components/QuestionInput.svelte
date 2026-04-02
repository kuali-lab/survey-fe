<script lang="ts">
  import type { Question, AnswerValue } from '$lib/types.js'

  let {
    question,
    value,
    onChange
  }: {
    question: Question
    value: AnswerValue
    onChange: (v: AnswerValue) => void
  } = $props()

  // Text helpers
  const strValue = $derived(typeof value === 'string' ? value : (value != null ? String(value) : ''))
  const numValue = $derived(typeof value === 'number' ? value : null)

  // For website: strip https:// prefix from display
  const websiteDisplay = $derived(
    strValue.startsWith('https://') ? strValue.slice(8)
    : strValue.startsWith('http://') ? strValue.slice(7)
    : strValue
  )

  // Checkbox / single_choice helpers
  const arrValue = $derived(Array.isArray(value) ? (value as string[]) : [])

  // Options for choice types — already a typed array from the normalized schema
  const options = $derived(question.options ?? [])

  // Rating
  const ratingScale = $derived(question.maxStars ?? 5)
  const ratingStars = $derived(Array.from({ length: ratingScale }, (_, i) => i + 1))
  const ratingValue = $derived(typeof value === 'number' ? value : 0)

  // NPS: 0-10
  const npsButtons = $derived(Array.from({ length: 11 }, (_, i) => i))
  const npsValue = $derived(typeof value === 'number' ? value : -1)

  // Opinion scale
  const opMin = $derived(question.minValue ?? 1)
  const opMax = $derived(question.maxValue ?? 10)
  const opButtons = $derived(Array.from({ length: opMax - opMin + 1 }, (_, i) => opMin + i))
  const opValue = $derived(typeof value === 'number' ? value : null)
  const opMinLabel = $derived(question.minLabel ?? '')
  const opMaxLabel = $derived(question.maxLabel ?? '')

  // Matrix — value is Record<rowLabel, colLabel>
  const matrixRows = $derived(question.matrixRows ?? [])
  const matrixCols = $derived(question.matrixCols ?? [])
  const matrixValue = $derived(
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string>)
      : {} as Record<string, string>
  )

  function setMatrixCell(rowLabel: string, colLabel: string) {
    const updated = { ...matrixValue, [rowLabel]: colLabel }
    onChange(updated)
  }

  function toggleCheckbox(label: string) {
    const current = Array.isArray(value) ? [...(value as string[])] : []
    const idx = current.indexOf(label)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(label)
    }
    onChange(current)
  }
</script>

{#if question.type === 'short_text'}
  <input
    class="text-input"
    type="text"
    placeholder={question.placeholder ?? ''}
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />

{:else if question.type === 'long_text'}
  <textarea
    class="textarea-input"
    rows="4"
    placeholder={question.placeholder ?? ''}
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLTextAreaElement).value)}
  ></textarea>

{:else if question.type === 'email'}
  <input
    class="text-input"
    type="email"
    placeholder="contoh@email.com"
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />

{:else if question.type === 'phone'}
  <input
    class="text-input"
    type="tel"
    placeholder="+62 8xx xxxx xxxx"
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />

{:else if question.type === 'website'}
  <div class="url-field">
    <span class="prefix">https://</span>
    <input
      class="url-input"
      type="text"
      placeholder={question.placeholder ?? 'contoh.com'}
      value={websiteDisplay}
      oninput={(e) => onChange('https://' + (e.currentTarget as HTMLInputElement).value)}
    />
  </div>

{:else if question.type === 'number'}
  <input
    class="text-input"
    type="number"
    min={question.minValue}
    max={question.maxValue}
    value={numValue !== null ? numValue : ''}
    oninput={(e) => {
      const v = (e.currentTarget as HTMLInputElement).value
      onChange(v === '' ? null : Number(v))
    }}
  />

{:else if question.type === 'date'}
  <input
    class="text-input"
    type="date"
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />

{:else if question.type === 'single_choice'}
  <div class="options-list">
    {#each options as opt}
      <button
        class="option-card {strValue === opt.label ? 'selected' : ''}"
        type="button"
        onclick={() => onChange(opt.label)}
      >
        <span class="radio-indicator {strValue === opt.label ? 'selected' : ''}"></span>
        <span class="option-label">{opt.label}</span>
      </button>
    {/each}
  </div>

{:else if question.type === 'checkbox'}
  <div class="options-list">
    {#each options as opt}
      {@const checked = arrValue.includes(opt.label)}
      <button
        class="option-card {checked ? 'selected' : ''}"
        type="button"
        onclick={() => toggleCheckbox(opt.label)}
      >
        <span class="checkbox-indicator {checked ? 'selected' : ''}">
          {#if checked}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="option-label">{opt.label}</span>
      </button>
    {/each}
  </div>

{:else if question.type === 'dropdown'}
  <select
    class="select-input"
    value={strValue}
    onchange={(e) => onChange((e.currentTarget as HTMLSelectElement).value)}
  >
    <option value="">-- Pilih salah satu --</option>
    {#each options as opt}
      <option value={opt.label}>{opt.label}</option>
    {/each}
  </select>

{:else if question.type === 'yes_no'}
  <div class="yes-no-wrap">
    <button
      class="yes-no-btn {strValue === 'yes' ? 'selected' : ''}"
      type="button"
      onclick={() => onChange('yes')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l5 5 9-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Ya
    </button>
    <button
      class="yes-no-btn {strValue === 'no' ? 'selected' : ''}"
      type="button"
      onclick={() => onChange('no')}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      Tidak
    </button>
  </div>

{:else if question.type === 'rating'}
  <div class="stars-wrap">
    {#each ratingStars as star}
      <button
        class="star-btn"
        type="button"
        aria-label="Beri nilai {star}"
        onclick={() => onChange(star)}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z"
            fill={star <= ratingValue ? '#f7bb00' : '#d9dde3'}
            stroke={star <= ratingValue ? '#e8ae00' : '#c8ccd2'}
            stroke-width="1"
          />
        </svg>
      </button>
    {/each}
  </div>

{:else if question.type === 'nps'}
  <div class="nps-wrap">
    <div class="nps-buttons">
      {#each npsButtons as n}
        <button
          class="nps-btn {npsValue === n ? 'selected' : ''}"
          type="button"
          onclick={() => onChange(n)}
        >{n}</button>
      {/each}
    </div>
    <div class="nps-labels">
      <span>Sangat Tidak Mungkin</span>
      <span>Sangat Mungkin</span>
    </div>
  </div>

{:else if question.type === 'opinion_scale'}
  <div class="opinion-wrap">
    <div class="opinion-buttons">
      {#each opButtons as n}
        <button
          class="opinion-btn {opValue === n ? 'selected' : ''}"
          type="button"
          onclick={() => onChange(n)}
        >{n}</button>
      {/each}
    </div>
    {#if opMinLabel || opMaxLabel}
      <div class="opinion-labels">
        <span>{opMinLabel}</span>
        <span>{opMaxLabel}</span>
      </div>
    {/if}
  </div>

{:else if question.type === 'matrix'}
  <div class="matrix-wrap">
    <table class="matrix-table">
      <thead>
        <tr>
          <th class="matrix-row-header"></th>
          {#each matrixCols as col}
            <th class="matrix-col-header">{col.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each matrixRows as row}
          <tr class="matrix-row">
            <td class="matrix-row-label">{row.label}</td>
            {#each matrixCols as col}
              {@const selected = matrixValue[row.label] === col.label}
              <td class="matrix-cell">
                <button
                  class="matrix-radio {selected ? 'selected' : ''}"
                  type="button"
                  aria-label="{row.label}: {col.label}"
                  onclick={() => setMatrixCell(row.label, col.label)}
                >
                  <span class="radio-dot"></span>
                </button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

{:else if question.type === 'statement'}
  {#if question.description}
    <div class="statement-body">
      <p>{question.description}</p>
    </div>
  {/if}

{:else}
  <!-- Fallback for unhandled types -->
  <input
    class="text-input"
    type="text"
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />
{/if}

<style>
  /* ── Text inputs ── */
  .text-input {
    width: 100%;
    height: 52px;
    border: 1px solid #d9dde3;
    border-radius: 14px;
    padding: 0 20px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--tertiary-80);
    background: white;
    transition: border-color 0.2s, box-shadow 0.2s;
    appearance: none;
    -webkit-appearance: none;
  }

  .text-input:focus {
    outline: none;
    border-color: #f7bb00;
    box-shadow: 0 0 0 3px #fce18e;
  }

  .textarea-input {
    width: 100%;
    border: 1px solid #d9dde3;
    border-radius: 14px;
    padding: 14px 20px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--tertiary-80);
    background: white;
    resize: vertical;
    min-height: 120px;
    transition: border-color 0.2s, box-shadow 0.2s;
    line-height: 1.5;
  }

  .textarea-input:focus {
    outline: none;
    border-color: #f7bb00;
    box-shadow: 0 0 0 3px #fce18e;
  }

  /* ── URL field ── */
  .url-field {
    display: flex;
    align-items: center;
    border: 1px solid #d9dde3;
    border-radius: 14px;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;
    background: white;
  }

  .url-field:focus-within {
    border-color: #f7bb00;
    box-shadow: 0 0 0 3px #fce18e;
  }

  .prefix {
    padding: 0 12px 0 20px;
    font-size: 15px;
    color: var(--tertiary-60);
    white-space: nowrap;
    flex-shrink: 0;
    height: 52px;
    display: flex;
    align-items: center;
    background: var(--tertiary-20);
    border-right: 1px solid #d9dde3;
  }

  .url-input {
    flex: 1;
    height: 52px;
    border: none;
    padding: 0 20px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--tertiary-80);
    background: transparent;
    outline: none;
  }

  /* ── Select ── */
  .select-input {
    width: 100%;
    height: 52px;
    border: 1px solid #d9dde3;
    border-radius: 14px;
    padding: 0 40px 0 20px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--tertiary-80);
    background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%238c8f93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 16px center;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .select-input:focus {
    outline: none;
    border-color: #f7bb00;
    box-shadow: 0 0 0 3px #fce18e;
  }

  /* ── Option cards ── */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-card {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    border: 1px solid #d9dde3;
    border-radius: 8px;
    padding: 12px 16px;
    background: white;
    cursor: pointer;
    font-family: var(--font);
    font-size: 15px;
    color: var(--tertiary-80);
    transition: border-color 0.15s, background 0.15s;
  }

  .option-card:hover {
    border-color: #f7bb00;
    background: #fffbed;
  }

  .option-card.selected {
    border-color: #f7bb00;
    background: #fffbed;
  }

  .radio-indicator {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #d9dde3;
    flex-shrink: 0;
    transition: border-color 0.15s;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .radio-indicator.selected {
    border-color: #f7bb00;
    border-width: 5px;
  }

  .checkbox-indicator {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 2px solid #d9dde3;
    flex-shrink: 0;
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .checkbox-indicator.selected {
    border-color: #f7bb00;
    background: #f7bb00;
  }

  .option-label {
    flex: 1;
  }

  /* ── Yes/No ── */
  .yes-no-wrap {
    display: flex;
    gap: 12px;
  }

  .yes-no-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 20px;
    border: 2px solid #d9dde3;
    border-radius: var(--radius-lg);
    background: white;
    font-family: var(--font);
    font-size: 16px;
    font-weight: 600;
    color: var(--tertiary-70);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }

  .yes-no-btn:hover {
    border-color: #f7bb00;
    background: #fffbed;
    color: var(--tertiary-80);
  }

  .yes-no-btn.selected {
    border-color: #f7bb00;
    background: #f7bb00;
    color: #221500;
  }

  /* ── Rating stars ── */
  .stars-wrap {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .star-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    transition: transform 0.1s;
  }

  .star-btn:hover {
    transform: scale(1.15);
  }

  /* ── NPS ── */
  .nps-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .nps-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .nps-btn {
    width: 40px;
    height: 40px;
    border: 1px solid #d9dde3;
    border-radius: var(--radius-md);
    background: white;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: var(--tertiary-70);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nps-btn:hover {
    border-color: #f7bb00;
    background: #fffbed;
  }

  .nps-btn.selected {
    border-color: #f7bb00;
    background: #f7bb00;
    color: #221500;
  }

  .nps-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--tertiary-60);
    padding: 0 2px;
  }

  /* ── Opinion scale ── */
  .opinion-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .opinion-buttons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .opinion-btn {
    min-width: 40px;
    height: 40px;
    padding: 0 8px;
    border: 1px solid #d9dde3;
    border-radius: var(--radius-md);
    background: white;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: var(--tertiary-70);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .opinion-btn:hover {
    border-color: #f7bb00;
    background: #fffbed;
  }

  .opinion-btn.selected {
    border-color: #f7bb00;
    background: #f7bb00;
    color: #221500;
  }

  .opinion-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--tertiary-60);
    padding: 0 2px;
  }

  /* ── Matrix ── */
  .matrix-wrap {
    overflow-x: auto;
  }

  .matrix-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .matrix-col-header {
    text-align: center;
    padding: 8px 12px;
    font-weight: 600;
    font-size: 13px;
    color: var(--tertiary-60);
    white-space: nowrap;
    border-bottom: 1px solid #e8eaed;
  }

  .matrix-row-header {
    padding: 8px;
    border-bottom: 1px solid #e8eaed;
  }

  .matrix-row:nth-child(even) {
    background: var(--tertiary-10, #f9fafb);
  }

  .matrix-row-label {
    padding: 12px 16px 12px 4px;
    font-size: 14px;
    color: var(--tertiary-80);
    line-height: 1.4;
    min-width: 120px;
  }

  .matrix-cell {
    text-align: center;
    padding: 8px 12px;
    vertical-align: middle;
  }

  .matrix-radio {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid #d9dde3;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    transition: border-color 0.15s, background 0.15s;
  }

  .matrix-radio:hover {
    border-color: #f7bb00;
    background: #fffbed;
  }

  .matrix-radio.selected {
    border-color: #f7bb00;
    background: #f7bb00;
  }

  .matrix-radio .radio-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: transparent;
    transition: background 0.15s;
  }

  .matrix-radio.selected .radio-dot {
    background: #221500;
  }

  /* ── Statement ── */
  .statement-body {
    background: var(--tertiary-20);
    border-radius: var(--radius-md);
    padding: 16px 20px;
  }

  .statement-body p {
    font-size: 16px;
    color: var(--tertiary-70);
    line-height: 1.6;
    white-space: pre-wrap;
  }
</style>
