<script lang="ts">
  import type { Question, AnswerValue, ContactInfo, Answers } from '$lib/types.js'
  import { PUBLIC_API_BASE_URL } from '$env/static/public'
  import { untrack } from 'svelte'
  import type { Action } from 'svelte/action'
  import flatpickr from 'flatpickr'
  import 'flatpickr/dist/flatpickr.css'
  import RegionInput from './RegionInput.svelte'
  import SearchableDropdown from './SearchableDropdown.svelte'
  import MatrixInput from './MatrixInput.svelte'
  import { sanitizePhoneInput } from '$lib/phone.js'
  import {
    buildOptionFilter, hasOptionFilter, filterDisabledHint, filterEmptyMessage,
  } from '$lib/optionFilter.js'
  import {
    visibleOptions, dependencyDisabledHint, dependencyEmptyMessage, dependencyParentLabel,
  } from '$lib/optionDependency.js'
  import { getRegionName, resolveRegionName } from '$lib/regionNames.js'
  import { applyNumberInput, numberInputText, numberInputCompare } from '$lib/numberInput.js'
  import { fade, fly } from 'svelte/transition'
  import { flip } from 'svelte/animate'
  import { useI18n } from '$lib/i18n/context.js'
  import { cubicOut } from 'svelte/easing'
  import {
    isTopOfMindQuestion, topOfMindFirst, topOfMindRest, remainingOptions, restLimit, restAtLimit,
    setTopOfMindFirst, toggleTopOfMindRest, clearTopOfMind, normalizeTopOfMind, topOfMindOtherText, firstIsOther,
  } from '$lib/topOfMind.js'

  let {
    question,
    value,
    onChange,
    onBlur,
    slug = '',
    answers = {},
    questions = [],
    // 🔴 Pratinjau: draf tidak punya slug, jadi unggahan akan menembak
    // `/s//upload`. Itu permintaan keluar dari halaman yang seharusnya nol
    // pengiriman — dimatikan di sini, dengan kalimat yang menjelaskan, bukan
    // dibiarkan gagal sendiri sebagai "Tidak dapat mengunggah berkas".
    pratinjau = false,
    // Top of Mind: one-per-page mode renders stage 2 as an "extended question"
    // (first pick excluded, intro line) instead of pinning the first pick.
    paged = false,
  }: {
    question: Question
    value: AnswerValue
    onChange: (v: AnswerValue) => void
    onBlur?: () => void
    slug?: string
    // Daftar Pilihan Bersaring: a filtered dropdown reads its source answers
    // from the whole answer map. Only dropdowns with filterConfig use these.
    answers?: Answers
    questions?: Question[]
    pratinjau?: boolean
    paged?: boolean
  } = $props()

  // ── Two-language surveys ──────────────────────────────────────────────────────
  // 🔴 `i18n.label(...)` / `i18n.text(...)` are ONLY for displayed text. Every
  // `onChange(...)`, `includes(...)` and comparison in this file keeps using
  // `opt.label` (the primary language): that is the answer value that gets stored,
  // compared by skip logic / Pilihan Bertingkat, and sent to the backend.
  const i18n = useI18n()
  const placeholderText = $derived(i18n.text(question, 'placeholder'))

  // ── Filtered dropdown (contract §8) ─────────────────────────────────────────
  const filterActive = $derived(question.type === 'dropdown' && hasOptionFilter(question))
  // null while any source question is unanswered → dropdown disabled.
  const optionFilter = $derived(filterActive ? buildOptionFilter(question, answers, questions) : null)
  const filterHint = $derived(filterActive ? filterDisabledHint(question) : '')
  // Selected source option LABELS (not values) for the empty-state wording.
  const filterAttrLabels = $derived.by(() => {
    if (!filterActive) return [] as string[]
    return (question.filterConfig?.attrs ?? []).map((a) => {
      const v = answers[a.sourceQuestionId]
      return typeof v === 'string' ? v.trim() : ''
    })
  })
  // Region name for the chosen code: RegionInput records what it lists/picks;
  // a code restored from a draft may need one lookup.
  const filterRegionCode = $derived(optionFilter?.regionCode ?? '')
  let filterRegionName = $state('')
  $effect(() => {
    const code = filterRegionCode
    if (!code) { filterRegionName = ''; return }
    const known = getRegionName(code)
    if (known) { filterRegionName = known; return }
    filterRegionName = ''
    void resolveRegionName(code).then((name) => {
      if (code === filterRegionCode) filterRegionName = name
    })
  })
  const filterEmptyText = $derived(
    filterActive ? filterEmptyMessage(question, filterRegionName || filterRegionCode, filterAttrLabels) : '',
  )

  // Text helpers
  const strValue = $derived(typeof value === 'string' ? value : (value != null ? String(value) : ''))
  // `number` answers travel as the literal typed text so leading zeros survive
  // (see numberInput.ts). Older drafts / outbox payloads still hold real numbers,
  // so both shapes must render. numText is what the input shows; numCompare is
  // the numeric view used only for the min/max blur correction.
  const numText = $derived(numberInputText(value))
  const numCompare = $derived(numberInputCompare(value))
  // Live number-range warning (below min / capped at max). Shown red + shakes on
  // each offending keystroke. shakeKey bumps to replay the shake animation.
  let numberWarn = $state<string | null>(null)
  let shakeKey = $state(0)

  // ── Date question ──────────────────────────────────────────────────────────
  // Native date/month picker: respondent picks from a calendar (no manual typing),
  // and the value is stored as canonical ISO (YYYY-MM-DD, or YYYY-MM for MM/YYYY).
  // ISO keeps every consumer correct — most importantly the skip-logic engine,
  // which compares dates lexicographically. The configured dateFormat is shown as
  // a formatted echo of the chosen value (the native widget uses the OS locale).
  const dateFmt = $derived(question.dateFormat || 'DD/MM/YYYY')

  function isoToDisplay(iso: string, fmt: string): string {
    if (!iso) return ''
    const [Y, M, D] = iso.split('-')
    if (fmt === 'YYYY-MM-DD') return D ? `${Y}-${M}-${D}` : `${Y}-${M}`
    if (fmt === 'MM/DD/YYYY') return D ? `${M}/${D}/${Y}` : `${M}/${Y}`
    if (fmt === 'MM/YYYY') return `${M}/${Y}`
    return D ? `${D}/${M}/${Y}` : `${M}/${Y}` // DD/MM/YYYY
  }

  // flatpickr → builder's configured format. The stored value stays ISO
  // (dateFormat:'Y-m-d'); only the visible altInput shows the chosen altFormat.
  // allowInput:false forces calendar selection (no manual typing). SSR-safe:
  // Svelte actions run only in the browser. Used for full-date formats; MM/YYYY
  // uses a native month input (flatpickr month-only needs a plugin).
  function flatpickrAltFormat(fmt: string): string {
    if (fmt === 'MM/DD/YYYY') return 'm/d/Y'
    if (fmt === 'YYYY-MM-DD') return 'Y-m-d'
    return 'd/m/Y' // DD/MM/YYYY (default)
  }

  type DatePickerParams = { value: string; fmt: string; onPick: (iso: string) => void; onClose?: () => void }
  const datePicker: Action<HTMLInputElement, DatePickerParams> = (node, params) => {
    let p = params as DatePickerParams
    const fp = flatpickr(node, {
      dateFormat: 'Y-m-d',
      altInput: true,
      altInputClass: 'survey-date-input',
      altFormat: flatpickrAltFormat(p.fmt),
      allowInput: false,
      defaultDate: p.value || undefined,
      onChange: (_dates, dateStr) => p.onPick(dateStr),
      onClose: () => p.onClose?.(),
    })
    return {
      update(next: DatePickerParams) {
        p = next
        if ((next.value || '') !== (fp.input.value || '')) {
          fp.setDate(next.value || '', false)
        }
      },
      destroy() {
        fp.destroy()
      },
    }
  }

  // For website: strip https:// prefix from display
  const websiteDisplay = $derived(
    strValue.startsWith('https://') ? strValue.slice(8)
    : strValue.startsWith('http://') ? strValue.slice(7)
    : strValue
  )

  // Checkbox / single_choice helpers
  const arrValue = $derived(Array.isArray(value) ? (value as string[]) : [])

  // Checkbox multi-select limit (0/undefined = unlimited). When the limit is
  // reached, unselected options are disabled; deselecting one frees a slot.
  // Answer shape (array) is unchanged → skip-logic / dataset / export unaffected.
  const selectLimit = $derived(question.maxSelections && question.maxSelections > 0 ? question.maxSelections : 0)
  const atSelectLimit = $derived(selectLimit > 0 && arrValue.length >= selectLimit)

  // Options for choice types — already a typed array from the normalized schema.
  // Pilihan Bertingkat (single_choice / manual dropdown with `dependsOn`): the
  // list is narrowed to the options allowed under the parent answer. While the
  // parent is unanswered the full list is shown greyed out and disabled.
  const allOptions = $derived(question.options ?? [])
  const dependency = $derived(visibleOptions(question, answers, questions))
  const dependencyWaiting = $derived(dependency.status === 'waiting')
  const dependencyHint = $derived(dependencyWaiting ? dependencyDisabledHint(question, questions) : '')
  const dependencyEmptyText = $derived(
    dependency.status === 'empty'
      ? dependencyEmptyMessage(question, dependencyParentLabel(question, answers), questions)
      : '',
  )
  const options = $derived(
    dependency.status === 'inactive' || dependencyWaiting ? allOptions : dependency.options,
  )

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
  const opMinLabel = $derived(i18n.text(question, 'minLabel') || i18n.t('scaleDisagree'))
  const opMaxLabel = $derived(i18n.text(question, 'maxLabel') || i18n.t('scaleAgree'))
  const opMidLabel = $derived(i18n.text(question, 'midLabel') || '')

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
      if (selectLimit > 0 && current.length >= selectLimit) return // batas tercapai
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

  // For single_choice: selected = strValue matches the isOther label OR user typed its own text.
  // Compared against the FULL option list so a narrowed (Pilihan Bertingkat)
  // list never mistakes a standard label for "Lainnya" free text.
  const isOtherSelected = $derived(
    otherOption ? (
      question.type === 'single_choice' || question.type === 'dropdown'
        ? strValue !== '' && !allOptions.filter(o => !o.isOther).some(o => o.label === strValue)
        : arrValue.some(v => !allOptions.filter(o => !o.isOther).some(o => o.label === v) && v !== '')
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
      if (selectLimit > 0 && current.length >= selectLimit) return // batas tercapai
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

  async function processFile(file: File) {
    if (pratinjau) {
      uploadError = 'Unggah berkas tidak aktif di pratinjau.'
      onChange(null)
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      uploadError = 'Ukuran berkas melebihi batas 10 MB.'
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

  function handleFileChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement
    const file = input.files?.[0] ?? null
    if (file) {
      processFile(file)
    }
    input.value = '' // Clear so same file can be re-selected if removed
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    if (uploading) return
    const file = e.dataTransfer?.files?.[0] ?? null
    if (file) {
      processFile(file)
    }
  }

  function removeUpload() {
    uploadFile = null
    uploadUrl = null
    uploadError = null
    onChange(null)
  }

  let dragOver = $state(false)

  function isImageUrl(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?|#|$)/i.test(url)
  }

  // Action: keep a textarea sized to its content. Adjusts on mount (so
  // restored values from localStorage don't clip) and on every input.
  function autoExpand(node: HTMLTextAreaElement) {
    const adjust = () => {
      node.style.height = 'auto'
      node.style.height = node.scrollHeight + 'px'
    }
    adjust()
    node.addEventListener('input', adjust)
    return {
      destroy() { node.removeEventListener('input', adjust) }
    }
  }

  // ── Top of Mind: one list, two stages (see $lib/topOfMind.ts) ─────────────
  // Looks like a plain checkbox question. The FIRST tap is recorded as the
  // top-of-mind pick: that row flips to the top (animate:flip), stays checked,
  // and a hint invites more picks. Tapping the pinned row again clears the
  // whole answer (stage 2 picks were relative to it). Stage is derived from
  // the answer, so back-navigation and draft resume need nothing extra.
  const tom = $derived(isTopOfMindQuestion(question))
  const tomFirst = $derived(topOfMindFirst(value))
  const tomRest = $derived(topOfMindRest(value))
  const tomRemaining = $derived(remainingOptions(options, tomFirst))
  const tomOtherOption = $derived(tomRemaining.find(o => o.isOther))
  const tomRestLimit = $derived(restLimit(question.maxSelections))
  const tomRestAtLimit = $derived(restAtLimit(value, question.maxSelections))
  const tomFirstIsOther = $derived(firstIsOther(value, allOptions))
  const tomStandardLabels = $derived(new Set(allOptions.filter(o => !o.isOther).map(o => o.label)))
  const tomOtherInRest = $derived(!tomFirstIsOther && tomRest.some(r => !tomStandardLabels.has(r)))
  // Paged mode: after the first tap the list stays put for a beat (the tap
  // lands visibly), then stage 2 slides in like a new question.
  let tomSettling = $state(false)
  const tomStage = $derived<1 | 2>(tomFirst === '' || tomSettling ? 1 : 2)
  // Re-mount the stage block on stage change only in paged mode (slide-in);
  // scroll mode keeps one list and flips the first pick to the top instead.
  const tomKey = $derived(paged ? tomStage : 0)

  // "Lainnya" as first pick: chosen but not yet confirmed with text.
  let tomOtherPending = $state(false)
  let tomOtherDraft = $state('')
  // "Lainnya" in stage 2 — same convention as the plain checkbox.
  let tomOtherText = $state(untrack(() => topOfMindOtherText(value, question.options ?? [])))

  const TOM_OTHER_KEY = '__other__'
  // The stored first pick (a primary-language label, or free "Lainnya" text)
  // → its display text.
  const tomFirstText = $derived.by(() => {
    const match = allOptions.find((o) => !o.isOther && o.label === tomFirst)
    return match ? i18n.label(match) : tomFirst
  })
  type TomRow = { key: string; label: string; display: string; isOther: boolean; isFirst: boolean; checked: boolean; disabled: boolean }
  // Keyed rows: the first pick keeps the key of the option it came from, so
  // animate:flip slides it to the top instead of re-rendering it.
  const tomRows = $derived.by<TomRow[]>(() => {
    const ordered = [...options.filter(o => !o.isOther), ...options.filter(o => o.isOther)]
    if (tomStage === 1) {
      return ordered.map(o => ({
        key: o.isOther ? TOM_OTHER_KEY : o.label, label: o.label, display: i18n.label(o), isOther: !!o.isOther,
        isFirst: false, checked: !!o.isOther && tomOtherPending, disabled: false,
      }))
    }
    const first: TomRow = {
      key: tomFirstIsOther ? TOM_OTHER_KEY : tomFirst, label: tomFirst, display: tomFirstText, isOther: tomFirstIsOther,
      isFirst: true, checked: true, disabled: false,
    }
    const rest = [...tomRemaining.filter(o => !o.isOther), ...tomRemaining.filter(o => o.isOther)].map(o => {
      const checked = o.isOther ? tomOtherInRest : tomRest.includes(o.label)
      return {
        key: o.isOther ? TOM_OTHER_KEY : o.label, label: o.label, display: i18n.label(o), isOther: !!o.isOther,
        isFirst: false, checked, disabled: !checked && tomRestAtLimit,
      }
    })
    // Paged mode: stage 2 shows only the remaining options — the first pick is
    // named in the intro line, not pinned in the list.
    return paged ? rest : [first, ...rest]
  })
  const tomShowOtherInput = $derived(tomStage === 1 ? tomOtherPending : tomOtherInRest)
  const tomHintText = $derived(
    tomRemaining.length === 0
      ? i18n.t('tomNoMore')
      : tomRestLimit > 0
        ? i18n.t('tomRestLimit', { limit: tomRestLimit, n: tomRest.length })
        : i18n.t('tomStage2Hint'),
  )

  const tomReduceMotion =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const tomFlip = { duration: tomReduceMotion ? 0 : 260, easing: cubicOut }
  const tomFade = { duration: tomReduceMotion ? 0 : 180 }
  const tomFly = { y: tomReduceMotion ? 0 : 16, duration: tomReduceMotion ? 0 : 220, easing: cubicOut }

  function tomSettleThenAdvance() {
    if (!paged || tomReduceMotion) return
    tomSettling = true
    setTimeout(() => {
      tomSettling = false
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 260)
  }

  function tomTapRow(row: TomRow) {
    if (row.isFirst) {
      tomOtherPending = false
      onChange(clearTopOfMind())
      return
    }
    if (tomStage === 1) {
      if (row.isOther) {
        tomOtherPending = true
        return
      }
      tomOtherPending = false
      onChange(setTopOfMindFirst(value, row.label))
      tomSettleThenAdvance()
      return
    }
    if (row.isOther) tomToggleOtherRest()
    else onChange(toggleTopOfMindRest(value, row.label, question.maxSelections))
  }
  function tomConfirmOtherFirst() {
    const text = tomOtherDraft.trim()
    if (!text) return
    tomOtherPending = false
    onChange(setTopOfMindFirst(value, text))
    tomSettleThenAdvance()
  }
  function tomToggleOtherRest() {
    if (!tomOtherOption) return
    if (tomOtherInRest) {
      onChange(normalizeTopOfMind(tomFirst, tomRest.filter(r => tomStandardLabels.has(r))))
    } else {
      if (tomRestAtLimit) return
      onChange(normalizeTopOfMind(tomFirst, [...tomRest, tomOtherText || tomOtherOption.label]))
    }
  }
  function tomUpdateOtherRest(text: string) {
    if (!tomOtherOption) return
    tomOtherText = text
    const cleaned = tomRest.filter(r => tomStandardLabels.has(r))
    cleaned.push(text || tomOtherOption.label)
    onChange(normalizeTopOfMind(tomFirst, cleaned))
  }
  function tomFocus(node: HTMLInputElement) {
    node.focus()
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
            <img src={question.optionImages[idx]} alt={i18n.label(opt)} class="image-option-img" />
          {:else}
            <div class="image-option-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="var(--surface-pressed)" stroke-width="1.5"/>
                <circle cx="8.5" cy="8.5" r="1.5" fill="var(--surface-pressed)"/>
                <path d="M3 16l5-5 4 4 3-3 6 5" stroke="var(--surface-pressed)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          {/if}
        </div>
        {#if question.showLabel !== false}
          <div class="image-option-footer">
            <span class="radio-indicator {strValue === opt.label ? 'selected' : ''}"></span>
            <span class="image-option-label">{i18n.label(opt)}</span>
          </div>
        {/if}
      </button>
    {/each}
  </div>

{:else if question.type === 'short_text'}
  <input
    class="text-input"
    type="text"
    placeholder={placeholderText}
    value={strValue}
    maxlength={question.maxLength ?? undefined}
    minlength={question.minLength ?? undefined}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
    onblur={() => onBlur?.()}
  />
  {#if question.maxLength || question.minLength}
    <div class="char-count" style="text-align: right; margin-top: 6px; font-size: 0.85rem; color: var(--text-body);">
      {strValue.length}{question.maxLength ? '/' + question.maxLength : ''}
    </div>
  {/if}

{:else if question.type === 'long_text'}
  <textarea
    class="textarea-input"
    rows="4"
    placeholder={placeholderText}
    value={strValue}
    maxlength={question.maxLength ?? undefined}
    minlength={question.minLength ?? undefined}
    oninput={(e) => onChange((e.currentTarget as HTMLTextAreaElement).value)}
    onblur={() => onBlur?.()}
    use:autoExpand
  ></textarea>
  {#if question.maxLength || question.minLength}
    <div class="char-count" style="text-align: right; margin-top: 6px; font-size: 0.85rem; color: var(--text-body);">
      {strValue.length}{question.maxLength ? '/' + question.maxLength : ''}
    </div>
  {/if}

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
    inputmode="numeric"
    placeholder="081234567890"
    value={strValue}
    oninput={(e) => onChange(sanitizePhoneInput((e.currentTarget as HTMLInputElement).value))}
    onblur={() => onBlur?.()}
  />

{:else if question.type === 'website'}
  <div class="url-field">
    <span class="prefix">https://</span>
    <input
      class="url-input"
      type="text"
      placeholder={placeholderText || 'contoh.com'}
      value={websiteDisplay}
      oninput={(e) => onChange('https://' + (e.currentTarget as HTMLInputElement).value)}
      onblur={() => onBlur?.()}
    />
  </div>

{:else if question.type === 'number'}
  <input
    class="text-input"
    type="number"
    inputmode="decimal"
    min={question.minValue}
    max={question.maxValue}
    value={numText}
    oninput={(e) => {
      // Truncation, the maxValue hard cap and the minValue warning all live in
      // applyNumberInput so they stay testable without a DOM.
      const r = applyNumberInput((e.currentTarget as HTMLInputElement).value, {
        maxLength: question.maxLength,
        minValue: question.minValue,
        maxValue: question.maxValue,
      })
      e.currentTarget.value = r.text
      if (r.warn) {
        numberWarn = r.warn
        shakeKey++
      } else {
        numberWarn = null
      }
      onChange(r.value)
    }}
    onblur={(e) => {
      // Clamp up to minValue on blur (clamping min while typing would block
      // entering any digit below it). The live warning above already informed the
      // respondent, so this correction is not silent.
      if (numCompare !== null && question.minValue != null && numCompare < question.minValue) {
        const clamped = String(question.minValue)
        ;(e.currentTarget as HTMLInputElement).value = clamped
        onChange(clamped)
      }
      numberWarn = null
      onBlur?.()
    }}
  />
  {#if numberWarn}
    {#key shakeKey}
      <p class="number-warn" role="alert">{numberWarn}</p>
    {/key}
  {/if}
  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      {#if question.minValue !== undefined && question.minValue !== null && question.maxValue !== undefined && question.maxValue !== null}
        <p class="number-hint" style="margin-top: 6px;">{i18n.t('numBetween', { min: question.minValue, max: question.maxValue })}</p>
      {:else if question.minValue !== undefined && question.minValue !== null}
        <p class="number-hint" style="margin-top: 6px;">{i18n.t('numMin', { min: question.minValue })}</p>
      {:else if question.maxValue !== undefined && question.maxValue !== null}
        <p class="number-hint" style="margin-top: 6px;">{i18n.t('numMax', { max: question.maxValue })}</p>
      {/if}
    </div>
    {#if question.maxLength || question.minLength}
      <div class="char-count" style="text-align: right; margin-top: 6px; font-size: 0.85rem; color: var(--text-body);">
        {strValue.length}{question.maxLength ? '/' + question.maxLength : ''}
      </div>
    {/if}
  </div>

{:else if question.type === 'date'}
  <!-- Calendar picker (no manual typing). Value stored as canonical ISO so
       skip-logic / dataset / export stay correct. Full-date formats use flatpickr
       (shows the configured format); MM/YYYY uses a native month picker. -->
  {#if dateFmt === 'MM/YYYY'}
    <input
      class="text-input"
      type="month"
      value={strValue}
      oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
      onblur={() => onBlur?.()}
    />
    {#if strValue}
      <p style="margin-top:6px;font-size:0.85rem;color:var(--text-body);">Format: {isoToDisplay(strValue, dateFmt)}</p>
    {/if}
  {:else}
    <div class="date-field">
      <input
        class="text-input"
        type="text"
        use:datePicker={{ value: strValue, fmt: dateFmt, onPick: (iso) => onChange(iso), onClose: () => onBlur?.() }}
      />
      <svg class="date-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    </div>
  {/if}

{:else if question.type === 'single_choice'}
  <div class="options-list" class:dependency-waiting={dependencyWaiting} aria-disabled={dependencyWaiting}>
    {#each options.filter(o => !o.isOther) as opt, i}
      <button
        class="option-card {strValue === opt.label ? 'selected' : ''}"
        type="button"
        disabled={dependencyWaiting}
        onclick={() => onChange(opt.label)}
      >
        <span class="radio-indicator {strValue === opt.label ? 'selected' : ''}"></span>
        <span class="option-label">{i18n.label(opt)}</span>
      </button>
    {/each}
    {#if otherOption}
      {@const otherIdx = options.filter(o => !o.isOther).length}
      <button
        class="option-card {isOtherSelected ? 'selected' : ''}"
        type="button"
        disabled={dependencyWaiting}
        onclick={selectOtherSingle}
      >
        <span class="radio-indicator {isOtherSelected ? 'selected' : ''}"></span>
        <span class="option-label">{i18n.label(otherOption)}</span>
      </button>
      {#if isOtherSelected}
        <input
          class="text-input other-text-input"
          type="text"
          placeholder={i18n.t('otherPlaceholder')}
          value={otherText}
          oninput={(e) => updateOtherSingle((e.currentTarget as HTMLInputElement).value)}
        />
      {/if}
    {/if}
  </div>
  {#if dependencyHint}
    <p class="dependency-note">{dependencyHint}</p>
  {:else if dependencyEmptyText}
    <p class="dependency-note dependency-empty">{dependencyEmptyText}</p>
  {/if}

{:else if question.type === 'checkbox' && tom}
  <div class="tom" data-tom-stage={tomStage}>
    {#key tomKey}
    <div class="tom-stage" in:fly={tomFly}>
    {#if paged && tomStage === 2}
      <p class="tom-intro" data-test="tom-intro">
        {i18n.t('tomFirst')} <strong>{tomFirstText}</strong>.
        <span class="tom-intro-more">{i18n.t('tomMore')} {tomHintText}</span>
      </p>
    {/if}
    <div class="options-list" role="group">
      {#each tomRows as row (row.key)}
        <div class="tom-row" animate:flip={tomFlip}>
          <button
            class="option-card {row.checked ? 'selected' : ''} {row.isFirst ? 'tom-first' : ''}"
            type="button"
            role="checkbox"
            aria-checked={row.checked}
            disabled={row.disabled}
            style={row.disabled ? 'opacity:0.55;cursor:not-allowed;' : ''}
            onclick={() => tomTapRow(row)}
          >
            <span class="checkbox-indicator {row.checked ? 'selected' : ''}">
              {#if row.checked}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              {/if}
            </span>
            <span class="option-label">{row.display}</span>
          </button>
          {#if row.isOther && !row.isFirst && tomShowOtherInput}
            {#if tomStage === 1}
              <div class="tom-other-row">
                <input
                  class="text-input other-text-input tom-other-input"
                  type="text"
                  placeholder={i18n.t('otherPlaceholder')}
                  value={tomOtherDraft}
                  use:tomFocus
                  oninput={(e) => { tomOtherDraft = (e.currentTarget as HTMLInputElement).value }}
                  onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tomConfirmOtherFirst() } }}
                />
                <button
                  class="tom-mini-btn"
                  type="button"
                  disabled={!tomOtherDraft.trim()}
                  onclick={tomConfirmOtherFirst}
                >{i18n.t('tomContinue')}</button>
              </div>
            {:else}
              <input
                class="text-input other-text-input"
                type="text"
                placeholder={i18n.t('otherPlaceholder')}
                value={tomOtherText}
                oninput={(e) => tomUpdateOtherRest((e.currentTarget as HTMLInputElement).value)}
              />
            {/if}
          {/if}
        </div>
      {/each}
    </div>
    {#if tomStage === 2 && !paged}
      <p class="tom-hint" in:fade={tomFade}>{tomHintText}</p>
    {/if}
    </div>
    {/key}
  </div>

{:else if question.type === 'checkbox'}
  <div class="options-list">
    {#each options.filter(o => !o.isOther) as opt, i}
      {@const checked = arrValue.includes(opt.label)}
      <button
        class="option-card {checked ? 'selected' : ''}"
        type="button"
        disabled={!checked && atSelectLimit}
        style={!checked && atSelectLimit ? 'opacity:0.55;cursor:not-allowed;' : ''}
        onclick={() => toggleCheckbox(opt.label)}
      >
        <span class="checkbox-indicator {checked ? 'selected' : ''}">
          {#if checked}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="option-label">{i18n.label(opt)}</span>
      </button>
    {/each}
    {#if otherOption}
      {@const otherIdx = options.filter(o => !o.isOther).length}
      <button
        class="option-card {isOtherSelected ? 'selected' : ''}"
        type="button"
        disabled={!isOtherSelected && atSelectLimit}
        style={!isOtherSelected && atSelectLimit ? 'opacity:0.55;cursor:not-allowed;' : ''}
        onclick={toggleOtherCheckbox}
      >
        <span class="checkbox-indicator {isOtherSelected ? 'selected' : ''}">
          {#if isOtherSelected}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l5 5 9-10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          {/if}
        </span>
        <span class="option-label">{i18n.label(otherOption)}</span>
      </button>
      {#if isOtherSelected}
        <input
          class="text-input other-text-input"
          type="text"
          placeholder={i18n.t('otherPlaceholder')}
          value={otherText}
          oninput={(e) => updateOtherCheckbox((e.currentTarget as HTMLInputElement).value)}
        />
      {/if}
    {/if}
  </div>
  {#if selectLimit > 0}
    <p style="margin-top:8px;font-size:0.85rem;color:var(--text-body);">{i18n.t('selectLimit', { limit: selectLimit, n: arrValue.length })}</p>
  {/if}

{:else if question.type === 'dropdown'}
  <div class="options-list">
      <!-- Always use the styled SearchableDropdown so small (manual) dropdowns look
           identical to large/async ones — no more native/unstyled <select>. -->
      <SearchableDropdown
        options={options}
        value={isOtherSelected && otherOption && strValue !== otherOption.label ? otherOption.label : strValue}
        onChange={(val) => {
          if (otherOption && val === otherOption.label) {
            onChange(otherText || otherOption.label);
          } else {
            onChange(val);
          }
        }}
        hasAsyncOptions={question.hasAsyncOptions}
        questionId={question.id}
        slug={slug}
        {filterActive}
        filter={optionFilter}
        filterHint={dependencyHint || filterHint}
        filterEmptyMessage={dependencyEmptyText || filterEmptyText}
        disabled={dependencyWaiting}
        notice={dependencyEmptyText}
      />
    {#if isOtherSelected}
      <input
        class="text-input other-text-input"
        type="text"
        placeholder={i18n.t('otherPlaceholder')}
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
        {i18n.t('yes')}
      </span>
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
        {i18n.t('no')}
      </span>
    </button>
  </div>

{:else if question.type === 'rating'}
  <div class="rating-wrap">
    <div class="stars-wrap">
      {#each ratingStars as star}
        <button
          class="star-btn"
          type="button"
          aria-label={i18n.t('ratingStar', { n: star })}
          onmouseenter={() => hoverRating = star}
          onmouseleave={() => hoverRating = 0}
          onclick={() => { onChange(star); hoverRating = 0 }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              class="star-path"
              d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z"
              fill={star <= (hoverRating || ratingValue) ? 'var(--ink)' : 'var(--canvas-soft)'}
              stroke={star <= (hoverRating || ratingValue) ? 'var(--ink)' : 'var(--surface-pressed)'}
              stroke-width="1"
            />
          </svg>
        </button>
      {/each}
    </div>
    {#if ratingValue > 0}
      <p class="rating-label" aria-live="polite">{i18n.t('ratingOf', { n: ratingValue, max: ratingScale })}</p>
    {/if}
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
      <span>{i18n.text(question, 'minLabel') || i18n.t('npsUnlikely')}</span>
      <span>{i18n.text(question, 'maxLabel') || i18n.t('npsLikely')}</span>
    </div>
  </div>

{:else if question.type === 'opinion_scale'}
  <div class="opinion-wrap">
    <div class="opinion-buttons">
      {#each opButtons as n}
        <button
          class="opinion-btn {opValue === n ? 'selected' : ''}"
          style="--scale-position: {opMax === opMin ? 0.5 : (n - opMin) / (opMax - opMin)};"
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
  {#key question.id}
    <MatrixInput rows={matrixRows} cols={matrixCols} value={matrixValue} onSelect={setMatrixCell} />
  {/key}

{:else if question.type === 'contact_info'}
  <div class="contact-grid">
    <input
      class="text-input"
      type="text"
      placeholder={i18n.t('firstName')}
      value={contactValue.firstName}
      oninput={(e) => updateContact('firstName', (e.currentTarget as HTMLInputElement).value)}
    />
    <input
      class="text-input"
      type="text"
      placeholder={i18n.t('lastName')}
      value={contactValue.lastName}
      oninput={(e) => updateContact('lastName', (e.currentTarget as HTMLInputElement).value)}
    />
    <input
      class="text-input"
      type="tel"
      inputmode="numeric"
      placeholder={i18n.t('phone')}
      value={contactValue.phone}
      oninput={(e) => updateContact('phone', sanitizePhoneInput((e.currentTarget as HTMLInputElement).value))}
    />
    <input
      class="text-input"
      type="email"
      placeholder={i18n.t('email')}
      value={contactValue.email}
      oninput={(e) => updateContact('email', (e.currentTarget as HTMLInputElement).value)}
    />
  </div>

{:else if question.type === 'file_upload'}
  <div class="file-upload-area">
    {#if uploadUrl}
      <!-- File already uploaded -->
      <div class="file-uploaded">
        {#if isImageUrl(uploadUrl)}
          <img class="file-preview" src="{uploadUrl}{uploadUrl.includes('?') ? '&' : '?'}action=raw" alt="Pratinjau berkas" />
        {:else}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="file-icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        {/if}
        <span class="file-name">{uploadFile?.name ?? 'Berkas diunggah'}</span>
        <button class="file-remove" type="button" onclick={removeUpload} aria-label="Hapus berkas">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    {:else}
      <label
        class="file-drop-zone {uploading ? 'uploading' : ''} {dragOver ? 'drag-over' : ''}"
        ondragover={(e) => { e.preventDefault(); dragOver = true }}
        ondragenter={(e) => { e.preventDefault(); dragOver = true }}
        ondragleave={() => { dragOver = false }}
        ondrop={handleDrop}
      >
        {#if uploading}
          <svg class="upload-spinner" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--canvas-soft)" stroke-width="2"/>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>Mengunggah berkas…</span>
        {:else}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
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

{:else if question.type === 'region'}
  <RegionInput
    value={value}
    regionDepth={question.regionDepth}
    onChange={onChange}
    {onBlur}
  />

{:else if question.type === 'statement'}
  {#if question.description}
    <div class="statement-body">
      <p>{@html i18n.text(question, 'description')}</p>
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
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    padding: 0 16px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-primary);
    background: var(--canvas-soft);
    transition: background 0.15s, border-color 0.15s;
    appearance: none;
    -webkit-appearance: none;
  }

  .text-input::placeholder { color: var(--text-muted); }

  .text-input:focus {
    outline: none;
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  /* flatpickr builds its visible "alt" input via JS, outside Svelte's scoped
     CSS — so the .text-input rule above can't reach it. Mirror the same look
     here via :global so the date field matches every other input. */
  .date-field {
    position: relative;
  }
  .date-field-icon {
    position: absolute;
    top: 50%;
    right: 16px;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    color: var(--text-body);
    pointer-events: none;
  }
  :global(.survey-date-input) {
    width: 100%;
    height: 52px;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    padding: 0 44px 0 16px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-primary);
    background: var(--canvas-soft);
    transition: background 0.15s, border-color 0.15s;
    appearance: none;
    -webkit-appearance: none;
  }
  :global(.survey-date-input:focus) {
    outline: none;
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  .textarea-input {
    width: 100%;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    padding: 14px 16px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-primary);
    background: var(--canvas-soft);
    resize: vertical;
    min-height: 120px;
    transition: background 0.15s, border-color 0.15s;
    line-height: 1.5;
  }

  .textarea-input::placeholder { color: var(--text-muted); }

  .textarea-input:focus {
    outline: none;
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  .number-hint {
    margin: 6px 4px 0;
    font-size: 12px;
    color: var(--text-body);
  }

  .number-warn {
    margin: 6px 4px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--error);
    animation: number-warn-shake 0.32s ease;
  }

  @keyframes number-warn-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .number-warn { animation: none; }
  }

  /* ── URL field ── */
  .url-field {
    display: flex;
    align-items: center;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    overflow: hidden;
    transition: background 0.15s, border-color 0.15s;
    background: var(--canvas-soft);
  }

  .url-field:focus-within {
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  .prefix {
    padding: 0 12px 0 16px;
    font-size: 14px;
    color: var(--text-body);
    white-space: nowrap;
    flex-shrink: 0;
    height: 52px;
    display: flex;
    align-items: center;
    background: transparent;
    border-right: 1px solid var(--surface-pressed);
  }

  .url-input {
    flex: 1;
    height: 52px;
    border: none;
    padding: 0 16px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-primary);
    background: transparent;
    outline: none;
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
    border: 1px solid var(--canvas-soft);
    border-radius: var(--radius-option);
    padding: 14px 16px;
    background: var(--canvas);
    cursor: pointer;
    font-family: var(--font);
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }

  .option-card:hover {
    border-color: var(--ink);
  }

  .option-card.selected {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--on-ink);
  }

  .radio-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--surface-pressed);
    flex-shrink: 0;
    background: var(--canvas);
    transition: border-color 0.15s, background 0.15s;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .option-card.selected .radio-indicator,
  .radio-indicator.selected {
    border-color: var(--on-ink);
    background: var(--on-ink);
    box-shadow: inset 0 0 0 4px var(--ink);
  }

  .checkbox-indicator {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    border: 2px solid var(--surface-pressed);
    flex-shrink: 0;
    background: var(--canvas);
    transition: border-color 0.15s, background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .option-card.selected .checkbox-indicator,
  .checkbox-indicator.selected {
    border-color: var(--on-ink);
    background: var(--on-ink);
  }

  .option-card.selected .checkbox-indicator :global(svg path) {
    stroke: var(--ink);
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
    justify-content: space-between;
    gap: 8px;
    padding: 16px 20px;
    height: 56px;
    border: 1px solid var(--canvas-soft);
    border-radius: var(--radius-pill);
    background: var(--canvas);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 500;
    color: var(--text-primary);
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
    border-color: var(--ink);
  }

  .yes-no-btn.selected {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--on-ink);
  }

  /* ── Rating stars ── */
  .rating-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

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

  @media (prefers-reduced-motion: no-preference) {
    .star-btn:hover {
      transform: scale(1.15);
    }
  }

  .star-path {
    transition: fill 0.18s ease, stroke 0.18s ease;
  }

  .rating-label {
    margin: 4px 0 0 4px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-body);
    font-variant-numeric: tabular-nums;
  }

  /* ── NPS (kept gradient on selected; chrome flips to canvas-soft) ── */
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
    height: 44px;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    background: var(--canvas-soft);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .nps-btn:hover { border-color: var(--ink); }

  .nps-btn.nps-red.selected { border-color: var(--scale-low); background: var(--scale-low); color: var(--on-ink); }
  .nps-btn.nps-amber.selected { border-color: var(--scale-mid); background: var(--scale-mid); color: var(--tertiary-100); }
  .nps-btn.nps-green.selected { border-color: var(--scale-high); background: var(--scale-high); color: var(--on-ink); }

  .nps-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-body);
    padding: 0 2px;
  }

  /* ── Opinion scale (kept gradient on selected; chrome flips to canvas-soft) ── */
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
    height: 44px;
    padding: 0 4px;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    background: var(--canvas-soft);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .opinion-btn:hover {
    border-color: var(--ink);
  }

  .opinion-btn.selected {
    background: hsl(calc(120 * var(--scale-position, 0.5)), 65%, 50%);
    border-color: hsl(calc(120 * var(--scale-position, 0.5)), 60%, 38%);
    color: var(--on-ink);
  }

  .opinion-labels {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--text-body);
    padding: 0 2px;
  }

  /* ── Statement ── */
  .statement-body {
    background: var(--canvas-soft);
    border-radius: var(--radius-card);
    padding: 16px 20px;
  }

  .statement-body p {
    font-size: 16px;
    color: var(--text-primary);
    line-height: 1.6;
    white-space: pre-wrap;
  }
  /* Rich-text markup from the builder. */
  .statement-body :global(b), .statement-body :global(strong) { font-weight: 700; }
  .statement-body :global(i), .statement-body :global(em) { font-style: italic; }
  .statement-body :global(u) { text-decoration: underline; }
  .statement-body :global(div) { margin: 0; }

  /* ── Image Choice ── */
  .image-choice-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .image-option-card {
    position: relative;
    border: 2px solid var(--canvas-soft);
    border-radius: var(--radius-option);
    overflow: hidden;
    background: var(--canvas);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
    padding: 0;
  }

  .image-option-card:hover { border-color: var(--ink); }

  .image-option-card.selected {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--on-ink);
  }

  .image-option-card.selected .image-option-label { color: var(--on-ink); }

  .image-option-img-wrap {
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    background: var(--canvas-soft);
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
    padding: 10px 12px;
  }

  .image-option-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
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

  /* ── Pilihan Bertingkat: waiting on the parent / nothing allowed ── */
  .options-list.dependency-waiting .option-card,
  .options-list.dependency-waiting .option-card:hover {
    opacity: 0.55;
    cursor: not-allowed;
    border-color: var(--canvas-soft);
  }
  .dependency-note {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .dependency-note.dependency-empty {
    color: var(--text-body);
    line-height: 1.5;
  }

  /* ── Top of Mind: one list, first pick flips to the top ── */
  .tom-row {
    display: flex;
    flex-direction: column;
  }
  .tom-intro {
    margin: 0 0 12px;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-body);
  }
  .tom-intro strong {
    color: var(--text-primary);
  }
  .tom-intro-more {
    display: block;
    margin-top: 2px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .tom-hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .tom-other-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .tom-other-row .tom-other-input {
    flex: 1;
    width: auto;
  }
  .tom-mini-btn {
    height: 44px;
    padding: 0 16px;
    border: none;
    border-radius: var(--radius-input);
    background: var(--ink);
    color: var(--on-ink);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
  }
  .tom-mini-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
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
    border: 2px dashed var(--surface-pressed);
    border-radius: var(--radius-option);
    padding: 32px 24px;
    cursor: pointer;
    text-align: center;
    transition: border-color 0.2s, background 0.2s;
    color: var(--text-body);
    font-size: 14px;
    font-weight: 500;
    position: relative;
    background: var(--canvas);
  }

  .file-drop-zone:hover {
    border-color: var(--ink);
    background: var(--canvas-soft);
  }

  .file-drop-zone.drag-over {
    border-color: var(--ink);
    border-style: solid;
    background: var(--canvas-soft);
    color: var(--text-primary);
  }

  .file-drop-zone.uploading {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .file-hint {
    font-size: 12px;
    color: var(--text-muted);
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
    background: var(--success-bg);
    border: 1px solid var(--success-border);
    border-radius: var(--radius-option);
    padding: 12px 16px;
    color: #166534;
  }

  .file-icon {
    flex-shrink: 0;
  }

  .file-preview {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid var(--success-border);
    background: var(--canvas);
  }

  .file-name {
    flex: 1;
    font-size: 14px;
    font-weight: 500;
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
    color: var(--error);
    font-weight: 500;
    padding: 0 4px;
  }

  .upload-spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .char-count {
    font-size: 12px;
    color: var(--tertiary-60);
    text-align: right;
    margin-top: 4px;
    padding-right: 4px;
  }
</style>



