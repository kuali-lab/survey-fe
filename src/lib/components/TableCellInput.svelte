<script lang="ts">
  /**
   * Satu sel tipe Tabel (angka, teks pendek, atau pilihan), dipakai grid desktop
   * dan accordion ponsel. Nilai yang dikirim ke atas selalu bahasa utama: label
   * opsi apa adanya, angka sebagai teks literal (lihat numberInput.ts).
   */
  import type { AnswerValue, Question } from '$lib/types.js'
  import { applyNumberInput, numberInputCompare, numberInputText } from '$lib/numberInput.js'
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
    /** Grid: label terpilih ditampilkan sebagai teks yang bisa turun baris, bukan terpotong elipsis. */
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
    class="cell-input"
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
  />
{:else if column.type === 'dropdown'}
  <div class="select-box" class:wrap={wrapValue}>
    {#if wrapValue}
      <span class="select-face" class:invalid aria-hidden="true">{chosen ? i18n.label(chosen) : i18n.t('tableSelectPlaceholder')}</span>
    {/if}
    <select
      class="cell-input"
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
  <input
    class="cell-input"
    type="text"
    maxlength={column.maxLength}
    value={text}
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={ariaDescribedBy}
    oninput={(e) => onChange(e.currentTarget.value)}
  />
{/if}
{#if warn}
  {#key shakeKey}
    <p class="cell-warn" role="alert">{warn}</p>
  {/key}
{/if}

<style>
  /* Berbeda dari .text-input kartu: grid punya baris belang ber-latar --canvas-soft,
     jadi sel butuh batas sendiri (tertiary-60: 3,25:1 di putih, 3,03:1 di belang). */
  .cell-input {
    width: 100%;
    /* --cell-min / --cell-pad diisi sel grid; accordion memakai bawaan. */
    min-width: var(--cell-min, 0);
    height: 44px;
    border: 1px solid var(--tertiary-60);
    border-radius: var(--radius-input);
    padding: 0 var(--cell-pad, 10px);
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-primary);
    background: var(--canvas);
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  /* Cincin 2px lewat box-shadow agar ukuran sel tidak bergeser. */
  .cell-input:focus {
    outline: none;
    border-color: var(--text-primary);
    box-shadow: 0 0 0 1px var(--text-primary);
  }

  .cell-input[aria-invalid='true'] {
    border-color: var(--error);
    box-shadow: 0 0 0 1px var(--error);
  }

  select.cell-input {
    min-width: var(--cell-min, 8rem);
    text-overflow: ellipsis;
  }

  /* Select bawaan tak bisa turun baris: di grid ia transparan di atas .select-face,
     jadi klik, keyboard, dan pembaca layar tetap milik select. */
  .select-box.wrap { position: relative; }

  .select-face {
    display: block;
    min-width: var(--cell-min, 8rem);
    min-height: 44px;
    padding: 10px 30px 10px var(--cell-pad, 10px);
    border: 1px solid var(--tertiary-60);
    border-radius: var(--radius-input);
    background: var(--canvas);
    font-size: 16px;
    line-height: 1.4;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .select-face::after {
    content: '';
    position: absolute;
    top: 19px;
    right: 12px;
    width: 6px;
    height: 6px;
    border-right: 2px solid var(--text-body);
    border-bottom: 2px solid var(--text-body);
    transform: rotate(45deg);
  }

  .select-box.wrap select {
    position: absolute;
    inset: 0;
    height: 100%;
    min-width: 0;
    opacity: 0;
    cursor: pointer;
  }

  .select-box.wrap:focus-within .select-face {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 1px var(--text-primary);
  }

  .select-face.invalid {
    border-color: var(--error);
    box-shadow: 0 0 0 1px var(--error);
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
