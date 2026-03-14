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

  const config = $derived(question.config)

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
  const arrValue = $derived(Array.isArray(value) ? value : [])

  function getOptions(): Array<{ label: string; value: string }> {
    const opts = config.options
    if (!Array.isArray(opts)) return []
    return opts.map((o: unknown) => {
      if (typeof o === 'string') return { label: o, value: o }
      if (o && typeof o === 'object' && 'label' in o) {
        const obj = o as Record<string, unknown>
        return {
          label: String(obj.label ?? ''),
          value: String(obj.value ?? obj.label ?? '')
        }
      }
      return { label: String(o), value: String(o) }
    })
  }

  const options = $derived(getOptions())

  // Rating
  const ratingScale = $derived(typeof config.scale === 'number' ? config.scale : 5)
  const ratingStars = $derived(Array.from({ length: ratingScale }, (_, i) => i + 1))
  const ratingValue = $derived(typeof value === 'number' ? value : 0)

  // NPS: 0-10
  const npsButtons = $derived(Array.from({ length: 11 }, (_, i) => i))
  const npsValue = $derived(typeof value === 'number' ? value : -1)

  // Opinion scale
  const opMin = $derived(typeof config.min === 'number' ? config.min : 1)
  const opMax = $derived(typeof config.max === 'number' ? config.max : 10)
  const opButtons = $derived(Array.from({ length: opMax - opMin + 1 }, (_, i) => opMin + i))
  const opValue = $derived(typeof value === 'number' ? value : null)
  const opMinLabel = $derived(typeof config.minLabel === 'string' ? config.minLabel : '')
  const opMaxLabel = $derived(typeof config.maxLabel === 'string' ? config.maxLabel : '')

  function toggleCheckbox(val: string) {
    const current = Array.isArray(value) ? [...value] : []
    const idx = current.indexOf(val)
    if (idx >= 0) {
      current.splice(idx, 1)
    } else {
      current.push(val)
    }
    onChange(current)
  }
</script>

{#if question.type === 'short_text'}
  <input
    class="text-input"
    type="text"
    placeholder={typeof config.placeholder === 'string' ? config.placeholder : ''}
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
  />

{:else if question.type === 'long_text'}
  <textarea
    class="textarea-input"
    rows="4"
    placeholder={typeof config.placeholder === 'string' ? config.placeholder : ''}
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
      placeholder={typeof config.placeholder === 'string' ? config.placeholder : 'contoh.com'}
      value={websiteDisplay}
      oninput={(e) => onChange('https://' + (e.currentTarget as HTMLInputElement).value)}
    />
  </div>

{:else if question.type === 'number'}
  <input
    class="text-input"
    type="number"
    min={typeof config.min === 'number' ? config.min : undefined}
    max={typeof config.max === 'number' ? config.max : undefined}
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
        class="option-card {strValue === opt.value ? 'selected' : ''}"
        type="button"
        onclick={() => onChange(opt.value)}
      >
        <span class="radio-indicator {strValue === opt.value ? 'selected' : ''}"></span>
        <span class="option-label">{opt.label}</span>
      </button>
    {/each}
  </div>

{:else if question.type === 'checkbox'}
  <div class="options-list">
    {#each options as opt}
      {@const checked = arrValue.includes(opt.value)}
      <button
        class="option-card {checked ? 'selected' : ''}"
        type="button"
        onclick={() => toggleCheckbox(opt.value)}
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
      <option value={opt.value}>{opt.label}</option>
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
