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
    onChange,
  }: {
    column: Question
    value: string | number | undefined
    /** "Baris — Kolom", nama aksesibel sel. */
    label: string
    invalid?: boolean
    describedBy?: string
    onChange: (v: AnswerValue) => void
  } = $props()

  const i18n = useI18n()
  const text = $derived(typeof value === 'string' ? value : '')
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
    aria-describedby={invalid ? describedBy : undefined}
    oninput={onNumberInput}
    onblur={onNumberBlur}
  />
{:else if column.type === 'dropdown'}
  <select
    class="cell-input"
    value={text}
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? describedBy : undefined}
    onchange={(e) => onChange(e.currentTarget.value)}
  >
    <option value="">{i18n.t('ddPlaceholder')}</option>
    {#each column.options ?? [] as opt (opt.id)}
      <option value={opt.label}>{i18n.label(opt)}</option>
    {/each}
  </select>
{:else}
  <input
    class="cell-input"
    type="text"
    maxlength={column.maxLength}
    value={text}
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid ? describedBy : undefined}
    oninput={(e) => onChange(e.currentTarget.value)}
  />
{/if}
{#if warn}
  {#key shakeKey}
    <p class="cell-warn" role="alert">{warn}</p>
  {/key}
{/if}

<style>
  /* Tampilan sama dengan .text-input di QuestionInput, dirapatkan untuk sel. */
  .cell-input {
    width: 100%;
    min-width: 0;
    height: 44px;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    padding: 0 10px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-primary);
    background: var(--canvas-soft);
    transition: background 0.15s, border-color 0.15s;
  }

  .cell-input:focus {
    outline: none;
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  .cell-input[aria-invalid='true'] {
    border-color: var(--error);
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
