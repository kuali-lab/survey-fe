<script lang="ts">
  /**
   * Satu sel tipe Tabel (angka, teks pendek, atau pilihan), dipakai grid desktop
   * dan accordion ponsel. Nilai yang dikirim ke atas selalu bahasa utama: label
   * opsi apa adanya, angka sebagai teks literal (lihat numberInput.ts).
   * Gaya isian = `.text-input` global (app.css); grid menambah `.cell-dense`.
   */
  import type { AnswerValue, Question } from '$lib/types.js'
  import { applyNumberInput, noWheelChange, numberInputCompare, numberInputText } from '$lib/numberInput.js'
  import { autoExpand } from '$lib/growTextarea.js'
  import { useI18n } from '$lib/i18n/context.js'

  let {
    column,
    value,
    label,
    invalid = false,
    describedBy,
    hintId,
    wrapValue = false,
    onChange,
  }: {
    column: Question
    value: string | number | undefined
    /** "Baris — Kolom", nama aksesibel sel. */
    label: string
    invalid?: boolean
    describedBy?: string
    /** Id petunjuk kolom yang tampil di samping sel (accordion). */
    hintId?: string
    /** Grid desktop: ukuran padat (`.cell-dense`). */
    wrapValue?: boolean
    onChange: (v: AnswerValue) => void
  } = $props()

  const i18n = useI18n()
  const ariaDescribedBy = $derived([hintId, invalid ? describedBy : undefined].filter(Boolean).join(' ') || undefined)
  const text = $derived(typeof value === 'string' ? value : '')
  const chosen = $derived(column.options?.find((o) => o.label === text))
  // Peringatan rentang angka saat mengetik; shakeKey memutar ulang animasi getar.
  let warn = $state<string | null>(null)
  let shakeKey = $state(0)

  function onNumberInput(e: Event & { currentTarget: HTMLInputElement }) {
    const r = applyNumberInput(e.currentTarget.value, {
      maxLength: column.maxLength,
      minValue: column.minValue,
      maxValue: column.maxValue,
    })
    e.currentTarget.value = r.text
    warn = r.warn
    if (r.warn) shakeKey++
    onChange(r.value)
  }

  // Sama dengan input angka biasa: nilai di bawah minimum dinaikkan saat blur.
  function onNumberBlur(e: Event & { currentTarget: HTMLInputElement }) {
    const n = numberInputCompare(value)
    if (n !== null && column.minValue != null && n < column.minValue) {
      e.currentTarget.value = String(column.minValue)
      onChange(String(column.minValue))
    }
    warn = null
  }
</script>

{#if column.type === 'number'}
  <input
    class="text-input"
    class:cell-dense={wrapValue}
    type="number"
    inputmode="decimal"
    min={column.minValue}
    max={column.maxValue}
    value={numberInputText(value)}
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={ariaDescribedBy}
    oninput={onNumberInput}
    onblur={onNumberBlur}
    use:noWheelChange
  />
{:else if column.type === 'dropdown'}
  <!-- Select bawaan tak bisa turun baris dan SearchableDropdown memotong label
       (elipsis) serta menu absolutnya terpotong wadah gulir tabel. Muka bergaya
       .text-input menampilkan label utuh; select transparan di atasnya memegang
       klik, keyboard, dan pembaca layar. -->
  <div class="select-box">
    <span class="text-input select-face" class:cell-dense={wrapValue} class:invalid aria-hidden="true">{chosen ? i18n.label(chosen) : i18n.t('tableSelectPlaceholder')}</span>
    <select
      value={text}
      title={chosen ? i18n.label(chosen) : undefined}
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      onchange={(e) => onChange(e.currentTarget.value)}
    >
      <option value="">{i18n.t('tableSelectPlaceholder')}</option>
      {#each column.options ?? [] as opt (opt.id)}
        <option value={opt.label}>{i18n.label(opt)}</option>
      {/each}
    </select>
  </div>
{:else}
  <!-- Enter = baris baru; runner mengabaikan tombol dari TEXTAREA, jadi tidak maju halaman. -->
  <textarea
    class="text-input grow-input"
    class:cell-dense={wrapValue}
    rows="1"
    maxlength={column.maxLength}
    value={text}
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={ariaDescribedBy}
    oninput={(e) => onChange(e.currentTarget.value)}
    use:autoExpand
  ></textarea>
{/if}
{#if warn}
  {#key shakeKey}
    <p class="cell-warn" role="alert">{warn}</p>
  {/key}
{/if}

<style>
  .text-input { display: block; }

  .text-input[aria-invalid='true'],
  .select-face.invalid {
    border-color: var(--error);
  }

  /* Grid desktop: 14px, kontrol ±32px. --cell-min dari columnMinRem (table.ts);
     padding 6px dan batas fokus 2px ikut dihitung di sana. */
  .cell-dense {
    min-width: var(--cell-min, 0);
    height: auto;
    min-height: 32px;
    padding: 5px 6px;
    font-size: 14px;
    line-height: 20px;
  }

  input.cell-dense { height: 32px; padding-block: 0; }

  /* Sentuh (iPad): <16px memicu zoom saat fokus, dan target sentuh minimal 44px. */
  @media (pointer: coarse) {
    .cell-dense { font-size: 16px; min-height: 44px; }
    input.cell-dense { height: 44px; }
  }

  .select-box { position: relative; }

  .select-face {
    height: auto;
    min-height: 52px;
    padding: 14px 36px 14px 16px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .select-face.cell-dense { padding-right: 22px; }

  .select-face::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 16px;
    width: 6px;
    height: 6px;
    margin-top: -5px;
    border-right: 2px solid var(--text-body);
    border-bottom: 2px solid var(--text-body);
    transform: rotate(45deg);
  }

  .select-face.cell-dense::after { right: 9px; }

  .select-box select {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    font-size: 16px;
  }

  /* Fokus milik select; muka meniru .text-input:focus (app.css). */
  .select-box:focus-within .select-face {
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  .cell-warn {
    margin: 4px 2px 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--error);
    animation: cell-warn-shake 0.32s ease;
  }

  @keyframes cell-warn-shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell-warn { animation: none; }
  }
</style>
