<script lang="ts">
  import type { Question, AnswerValue, ContactInfo } from '$lib/types.js'
  import { PUBLIC_API_BASE_URL } from '$env/static/public'
  import { untrack } from 'svelte'

  let {
    question,
    value,
    onChange,
    onBlur,
    slug = ''
  }: {
    question: Question
    value: AnswerValue
    onChange: (v: AnswerValue) => void
    onBlur?: () => void
    slug?: string
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
  let hoverRating = $state(0)

  // NPS: 0-10
  const npsButtons = $derived(Array.from({ length: 11 }, (_, i) => i))
  const npsValue = $derived(typeof value === 'number' ? value : -1)

  // Opinion scale
  const opMin = $derived(question.minValue ?? 1)
  const opMax = $derived(question.maxValue ?? 10)
  const opButtons = $derived(Array.from({ length: opMax - opMin + 1 }, (_, i) => opMin + i))
  const opValue = $derived(typeof value === 'number' ? value : null)
  const opMinLabel = $derived(question.minLabel || 'Sangat Tidak Setuju')
  const opMaxLabel = $derived(question.maxLabel || 'Sangat Setuju')
  const opMidLabel = $derived(question.midLabel || '')

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

  // contact_info helpers — value is a ContactInfo object
  const contactValue = $derived(
    value && typeof value === 'object' && !Array.isArray(value) && 'firstName' in (value as object)
      ? (value as ContactInfo)
      : { firstName: '', lastName: '', phone: '', email: '' }
  )

  function updateContact(field: keyof ContactInfo, val: string) {
    onChange({ ...contactValue, [field]: val })
  }

  // ── is_other ("Lainnya") state ──
  const otherOption = $derived(options.find(o => o.isOther))

  // For single_choice: selected = strValue matches the isOther label OR user typed its own text
  const isOtherSelected = $derived(
    otherOption ? (
      question.type === 'single_choice' || question.type === 'dropdown'
        ? strValue !== '' && !options.filter(o => !o.isOther).some(o => o.label === strValue)
        : arrValue.some(v => !options.filter(o => !o.isOther).some(o => o.label === v) && v !== '')
    ) : false
  )

  function deriveInitialOtherText(): string {
    const opts = question.options ?? []
    const otherOpt = opts.find(o => o.isOther)
    if (!otherOpt) return ''
    const standardLabels = opts.filter(o => !o.isOther).map(o => o.label)
    if (question.type === 'single_choice' || question.type === 'dropdown') {
      const sv = typeof value === 'string' ? value : ''
      return sv && !standardLabels.includes(sv) && sv !== otherOpt.label ? sv : ''
    }
    if (question.type === 'checkbox') {
      const av = Array.isArray(value) ? (value as string[]) : []
      return av.find(v => !standardLabels.includes(v) && v !== otherOpt.label) ?? ''
    }
    return ''
  }
  let otherText = $state(deriveInitialOtherText())

  function selectOtherSingle() {
    if (!otherOption) return
    onChange(otherText || otherOption.label)
  }
  function updateOtherSingle(text: string) {
    otherText = text
    onChange(text || otherOption?.label || '')
  }
  function toggleOtherCheckbox() {
    if (!otherOption) return
    const current = Array.isArray(value) ? [...(value as string[])] : []
    const hasOther = isOtherSelected;
    if (hasOther) {
      // Remove other
      const standardLabels = options.filter(o => !o.isOther).map(o => o.label)
      onChange(current.filter(v => standardLabels.includes(v)))
    } else {
      current.push(otherOption.label)
      onChange(current)
    }
  }
  
  function updateOtherCheckbox(text: string) {
    if (!otherOption) return
    otherText = text
    const current = Array.isArray(value) ? [...(value as string[])] : []
    const standardLabels = options.filter(o => !o.isOther).map(o => o.label)
    const cleaned = current.filter(v => standardLabels.includes(v))
    if (text) cleaned.push(text)
    else cleaned.push(otherOption.label)
    onChange(cleaned)
  }

  // ── file_upload state ──
  let uploadFile = $state<File | null>(null)
  let uploadUrl = $state<string | null>(untrack(() => strValue || null))
  let uploading = $state(false)
  let uploadError = $state<string | null>(null)

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB — matches the UI hint

  async function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0] ?? null
    if (!file) return

    // Client-side size guard so users see a clear message instead of
    // waiting for the upload to fail at the server.
    if (file.size > MAX_UPLOAD_BYTES) {
      uploadError = 'Ukuran berkas melebihi batas 10 MB.'
      input.value = ''
      onChange(null)
      return
    }

    uploadFile = file
    uploadError = null
    uploading = true
    onChange('__uploading__') // sentinel — blocks validation until done

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${PUBLIC_API_BASE_URL}/s/${slug}/upload`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.message ?? 'upload_failed')
      }
      const json = await res.json() as { url: string; name: string }
      uploadUrl = json.url
      onChange(json.url)
    } catch {
      uploadError = 'Tidak dapat mengunggah berkas. Coba lagi.'
      uploadUrl = null
      onChange(null)
    } finally {
      uploading = false
    }
  }

  function removeUpload() {
    uploadFile = null
    uploadUrl = null
    uploadError = null
    onChange(null)
  }
</script>

{#if question.type === 'image_choice'}
  <div class="image-choice-grid">
    {#each options as opt, idx}
      <button
        class="image-option-card {strValue === opt.label ? 'selected' : ''}"
        type="button"
        onclick={() => onChange(opt.label)}
      >
        <div class="image-option-img-wrap">
          {#if question.optionImages && question.optionImages[idx]}
            <img src={question.optionImages[idx]} alt={opt.label} class="image-option-img" />
          {:else}
            <div class="image-option-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="#d9dde3" stroke-width="1.5"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="#d9dde3"/>
                <path d="M3 16l5-5 4 4 3-3 6 5" stroke="#d9dde3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          {/if}
        </div>
        {#if question.showLabel !== false}
          <div class="image-option-footer">
            <span class="radio-indicator {strValue === opt.label ? 'selected' : ''}"></span>
            <span class="image-option-label">{opt.label}</span>
            <span class="option-letter" aria-hidden="true">{String.fromCharCode(65 + idx)}</span>
          </div>
        {:else}
          <span class="image-option-corner-letter" aria-hidden="true">{String.fromCharCode(65 + idx)}</span>
        {/if}
      </button>
    {/each}
  </div>

{:else if question.type === 'short_text'}
  <input
    class="text-input"
    type="text"
    placeholder={question.placeholder ?? ''}
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
    onblur={() => onBlur?.()}
  />

{:else if question.type === 'long_text'}
  <textarea
    class="textarea-input"
    rows="4"
    placeholder={question.placeholder ?? ''}
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLTextAreaElement).value)}
    onblur={() => onBlur?.()}
  ></textarea>

{:else if question.type === 'email'}
  <input
    class="text-input"
    type="email"
    placeholder="nama@email.com"
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
    onblur={() => onBlur?.()}
  />

{:else if question.type === 'phone'}
  <input
    class="text-input"
    type="tel"
    placeholder="+62 812 3456 7890"
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
    onblur={() => onBlur?.()}
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
      onblur={() => onBlur?.()}
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
    onblur={() => onBlur?.()}
  />

{:else if question.type === 'date'}
  <input
    class="text-input"
    type="date"
    value={strValue}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
    onblur={() => onBlur?.()}
  />

{:else if question.type === 'single_choice'}
  <div class="options-list">
    {#each options.filter(o => !o.isOther) as opt, i}
      <button
        class="option-card {strValue === opt.label ? 'selected' : ''}"
        type="button"
        onclick={() => onChange(opt.label)}
      >
        <span class="radio-indicator {strValue === opt.label ? 'selected' : ''}"></span>
        <span class="option-label">{opt.label}</span>
        <span class="option-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
      </button>
    {/each}
    {#if otherOption}
      {@const otherIdx = options.filter(o => !o.isOther).length}
      <button
        class="option-card {isOtherSelected ? 'selected' : ''}"
        type="button"
        onclick={selectOtherSingle}
      >
        <span class="radio-indicator {isOtherSelected ? 'selected' : ''}"></span>
        <span class="option-label">{otherOption.label}</span>
        <span class="option-letter" aria-hidden="true">{String.fromCharCode(65 + otherIdx)}</span>
      </button>
      {#if isOtherSelected}
        <input
          class="text-input other-text-input"
          type="text"
          placeholder="Tuliskan jawaban Anda..."
          value={otherText}
          oninput={(e) => updateOtherSingle((e.currentTarget as HTMLInputElement).value)}
        />
      {/if}
    {/if}
  </div>

{:else if question.type === 'checkbox'}
  <div class="options-list">
    {#each options.filter(o => !o.isOther) as opt, i}
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
        <span class="option-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span>
      </button>
    {/each}
    {#if otherOption}
      {@const otherIdx = options.filter(o => !o.isOther).length}
      <button
        class="option-card {isOtherSelected ? 'selected' : ''}"
        type="button"
        onclick={toggleOtherCheckbox}
      >
        <span class="checkbox-indicator {isOtherSelected ? 'selected' : ''}">
          {#if isOtherSelected}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="option-label">{otherOption.label}</span>
        <span class="option-letter" aria-hidden="true">{String.fromCharCode(65 + otherIdx)}</span>
      </button>
      {#if isOtherSelected}
        <input
          class="text-input other-text-input"
          type="text"
          placeholder="Tuliskan jawaban Anda..."
          value={otherText}
          oninput={(e) => updateOtherCheckbox((e.currentTarget as HTMLInputElement).value)}
        />
      {/if}
    {/if}
  </div>

{:else if question.type === 'dropdown'}
  <div class="options-list">
    <select
      class="select-input"
      value={isOtherSelected && otherOption && strValue !== otherOption.label ? otherOption.label : strValue}
      onchange={(e) => {
        const val = (e.currentTarget as HTMLSelectElement).value;
        if (otherOption && val === otherOption.label) {
          onChange(otherText || otherOption.label);
        } else {
          onChange(val);
        }
      }}
    >
      <option value="">-- Pilih salah satu --</option>
      {#each options.filter(o => !o.isOther) as opt}
        <option value={opt.label}>{opt.label}</option>
      {/each}
      {#if otherOption}
        <option value={otherOption.label}>{otherOption.label}</option>
      {/if}
    </select>
    {#if isOtherSelected}
      <input
        class="text-input other-text-input"
        type="text"
        placeholder="Tuliskan jawaban Anda..."
        value={otherText}
        oninput={(e) => updateOtherSingle((e.currentTarget as HTMLInputElement).value)}
      />
    {/if}
  </div>

{:else if question.type === 'yes_no'}
  <div class="yes-no-wrap">
    <button
      class="yes-no-btn {strValue === 'yes' ? 'selected' : ''}"
      type="button"
      onclick={() => onChange('yes')}
    >
      <span class="yes-no-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M5 12.5l5 5 9-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Ya
      </span>
      <span class="option-letter" aria-hidden="true">Y</span>
    </button>
    <button
      class="yes-no-btn {strValue === 'no' ? 'selected' : ''}"
      type="button"
      onclick={() => onChange('no')}
    >
      <span class="yes-no-content">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
        Tidak
      </span>
      <span class="option-letter" aria-hidden="true">T</span>
    </button>
  </div>

{:else if question.type === 'rating'}
  <div class="stars-wrap">
    {#each ratingStars as star}
      <button
        class="star-btn"
        type="button"
        aria-label="Beri nilai {star}"
        onmouseenter={() => hoverRating = star}
        onmouseleave={() => hoverRating = 0}
        onclick={() => { onChange(star); hoverRating = 0 }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z"
            fill={star <= (hoverRating || ratingValue) ? '#f7bb00' : '#d9dde3'}
            stroke={star <= (hoverRating || ratingValue) ? '#e8ae00' : '#c8ccd2'}
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
          class="nps-btn {npsValue === n ? 'selected' : ''} {n <= 6 ? 'nps-red' : n <= 8 ? 'nps-amber' : 'nps-green'}"
          type="button"
          onclick={() => onChange(n)}
        >{n}</button>
      {/each}
    </div>
    <div class="nps-labels">
      <span>{question.minLabel || 'Sangat Tidak Mungkin'}</span>
      <span>{question.maxLabel || 'Sangat Mungkin'}</span>
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
    {#if opMinLabel || opMaxLabel || opMidLabel}
      <div class="opinion-labels">
        <span>{opMinLabel}</span>
        {#if opMidLabel}<span class="opinion-mid-label">{opMidLabel}</span>{/if}
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

{:else if question.type === 'contact_info'}
  <div class="contact-grid">
    <input
      class="text-input"
      type="text"
      placeholder="Nama Depan"
      value={contactValue.firstName}
      oninput={(e) => updateContact('firstName', (e.currentTarget as HTMLInputElement).value)}
    />
    <input
      class="text-input"
      type="text"
      placeholder="Nama Belakang"
      value={contactValue.lastName}
      oninput={(e) => updateContact('lastName', (e.currentTarget as HTMLInputElement).value)}
    />
    <input
      class="text-input"
      type="tel"
      placeholder="Nomor Telepon"
      value={contactValue.phone}
      oninput={(e) => updateContact('phone', (e.currentTarget as HTMLInputElement).value)}
    />
    <input
      class="text-input"
      type="email"
      placeholder="Email"
      value={contactValue.email}
      oninput={(e) => updateContact('email', (e.currentTarget as HTMLInputElement).value)}
    />
  </div>

{:else if question.type === 'file_upload' || question.type === 'upload_file'}
  <div class="file-upload-area">
    {#if uploadUrl}
      <!-- File already uploaded -->
      <div class="file-uploaded">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="file-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="file-name">{uploadFile?.name ?? 'Berkas diunggah'}</span>
        <button class="file-remove" type="button" onclick={removeUpload} aria-label="Hapus berkas">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    {:else}
      <label class="file-drop-zone {uploading ? 'uploading' : ''}">
        {#if uploading}
          <svg class="upload-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#d9dde3" stroke-width="2"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#f7bb00" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Mengunggah berkas...</span>
        {:else}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="17 8 12 3 7 8" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="12" y1="3" x2="12" y2="15" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Klik atau seret berkas ke sini</span>
          <span class="file-hint">Gambar, PDF, atau Word — Maks. 10 MB</span>
        {/if}
        <input
          type="file"
          class="file-input-hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          disabled={uploading}
          onchange={handleFileChange}
        />
      </label>
    {/if}
    {#if uploadError}
      <p class="upload-error">{uploadError}</p>
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
    border-radius: 12px;
    padding: 12px 16px;
    background: white;
    cursor: pointer;
    font-family: var(--font);
    font-size: 15px;
    font-weight: 600;
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
    width: 20px;
    height: 20px;
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
    border-width: 6px;
  }

  .checkbox-indicator {
    width: 20px;
    height: 20px;
    border-radius: 6px;
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

  /* Letter shortcut chip — visual on every viewport, hotkey on desktop. */
  .option-letter {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1px solid #d9dde3;
    background: var(--tertiary-10, #f9fafb);
    color: var(--tertiary-60);
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    margin-left: auto;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }

  .option-card.selected .option-letter,
  .yes-no-btn.selected .option-letter {
    border-color: #e8ae00;
    background: white;
    color: #221500;
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
    justify-content: space-between;
    gap: 8px;
    padding: 16px 18px;
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

  .yes-no-content {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    justify-content: center;
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
  }

  .nps-btn {
    flex: 1;
    min-width: 0;
    height: 40px;
    border: 2px solid #d9dde3;
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

  .nps-btn.nps-red:hover { border-color: #ef4444; background: #fef2f2; }
  .nps-btn.nps-red.selected { border-color: #ef4444; background: #ef4444; color: white; }

  .nps-btn.nps-amber:hover { border-color: #f59e0b; background: #fffbeb; }
  .nps-btn.nps-amber.selected { border-color: #f59e0b; background: #f59e0b; color: #221500; }

  .nps-btn.nps-green:hover { border-color: #22c55e; background: #f0fdf4; }
  .nps-btn.nps-green.selected { border-color: #22c55e; background: #22c55e; color: white; }

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
  }

  .opinion-btn {
    flex: 1;
    min-width: 0;
    height: 40px;
    padding: 0 4px;
    border: 2px solid #d9dde3;
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

  /* ── Image Choice ── */
  .image-choice-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .image-option-card {
    position: relative;
    border: 2px solid #d9dde3;
    border-radius: 12px;
    overflow: hidden;
    background: white;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
    padding: 0;
  }

  .image-option-card:hover {
    border-color: #f7bb00;
  }

  .image-option-card.selected {
    border-color: #f7bb00;
    background: #fffbed;
  }

  /* Letter badge for image_choice when labels are hidden — corner overlay. */
  .image-option-corner-letter {
    position: absolute;
    top: 8px;
    left: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(0, 0, 0, 0.08);
    color: var(--tertiary-80);
    font-size: 11px;
    font-weight: 700;
    z-index: 1;
  }

  .image-option-card.selected .image-option-corner-letter {
    background: var(--primary-50, #f7bb00);
    color: #221500;
    border-color: #e8ae00;
  }

  .image-option-img-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: #f5f6f8;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-option-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-option-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .image-option-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  }

  .image-option-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--tertiary-80);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Contact Info ── */
  .contact-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  @media (max-width: 480px) {
    .image-choice-grid {
      grid-template-columns: 1fr 1fr;
    }
    .contact-grid {
      grid-template-columns: 1fr;
    }
  }

  /* ── Other text input ── */
  .other-text-input {
    margin-top: 6px;
    margin-left: 32px;
    width: calc(100% - 32px);
    height: 44px;
  }

  /* ── File Upload ── */
  .file-upload-area {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .file-drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 2px dashed #d9dde3;
    border-radius: 14px;
    padding: 32px 24px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.2s, background 0.2s;
    color: var(--tertiary-60);
    font-size: 14px;
    font-weight: 500;
    position: relative;
  }

  .file-drop-zone:hover {
    border-color: #f7bb00;
    background: #fffdf0;
  }

  .file-drop-zone.uploading {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .file-hint {
    font-size: 12px;
    color: var(--tertiary-40);
  }

  .file-input-hidden {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
  }

  .file-input-hidden:disabled {
    cursor: not-allowed;
  }

  .file-uploaded {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    padding: 12px 16px;
    color: #166534;
  }

  .file-icon {
    flex-shrink: 0;
  }

  .file-name {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-remove {
    background: none;
    border: none;
    cursor: pointer;
    color: #166534;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .file-remove:hover {
    background: #dcfce7;
  }

  .upload-error {
    font-size: 12px;
    color: var(--error-50, #dc2626);
    font-weight: 600;
    padding: 0 4px;
  }

  .upload-spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
</style>


