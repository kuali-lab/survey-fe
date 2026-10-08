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
  import SearchableDropdown from './SearchableDropdown.svelte'

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
  // >15 opsi: daftar bawaan ponsel/desktop tanpa pencarian terlalu panjang untuk dipindai.
  const searchable = $derived((column.options?.length ?? 0) > 15)
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
{:else if column.type === 'dropdown' && searchable}
  <!-- Menu floating (fixed) supaya tak terpotong .grid-wrap; pemicu dibungkus utuh, lihat gaya .cell-dd. -->
  <div class="cell-dd" class:dense={wrapValue}>
    <SearchableDropdown
      options={column.options ?? []}
      value={text}
      onChange={(v: string | string[]) => onChange(typeof v === 'string' ? v : '')}
      placeholder={i18n.t('tableSelectPlaceholder')}
      floating
      ariaLabel={chosen ? `${label}: ${i18n.label(chosen)}` : label}
      {invalid}
      ariaDescribedBy={ariaDescribedBy}
    />
  </div>
{:else if column.type === 'dropdown'}
  <!-- ≤15 opsi. Select bawaan tak bisa turun baris; muka bergaya .text-input
       menampilkan label utuh, select transparan di atasnya memegang klik,
       keyboard, dan pembaca layar. -->
  <div class="select-box">
    <span class="text-input grow-input select-face" class:cell-dense={wrapValue} class:invalid aria-hidden="true">{chosen ? i18n.label(chosen) : i18n.t('tableSelectPlaceholder')}</span>
    <select
      value={text}
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
  <!-- Enter = baris baru (keputusan produk 8 Okt, beda dari short_text biasa yang menolak Enter);
       runner mengabaikan tombol dari TEXTAREA, jadi tidak maju halaman. -->
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
    use:autoExpand={text}
  ></textarea>
{/if}
{#if warn}
  {#key shakeKey}
    <p class="cell-warn" role="alert">{warn}</p>
  {/key}
{/if}

<style>
  /* Batas isian ±1,05:1 terhadap putih sengaja sama dengan isian lain di survei. */
  .text-input { display: block; }

  .select-box { position: relative; }

  .text-input[aria-invalid='true'],
  .select-face.invalid {
    border-color: var(--error);
  }

  /* Ruang panah; ukuran lain dari .grow-input (app.css), .cell-dense di bawah menimpanya. */
  .select-face { padding-right: 36px; }

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

  /* Sentuh (iPad): <16px memicu zoom saat fokus, dan target sentuh minimal 44px.
     Lantai dikalibrasi untuk 14px; 16/14 ≈ 1,15 supaya "Kurikulum" tak terbelah. */
  @media (pointer: coarse) {
    .cell-dense { font-size: 16px; min-height: 44px; min-width: calc(var(--cell-min, 0px) * 1.15); }
    input.cell-dense { height: 44px; }
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
    /* Safari macOS mengabaikan height pada select berpenampilan bawaan. */
    appearance: none;
  }

  /* Fokus milik select; muka meniru .text-input:focus (app.css). */
  .select-box:focus-within .select-face {
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  /* High Contrast: warna batas dipaksa sistem, jadi fokus butuh outline sendiri. */
  @media (forced-colors: active) {
    .select-box:focus-within .select-face { outline: 2px solid Highlight; }
    .select-face::after { border-color: CanvasText; }
  }

  /* SearchableDropdown di sel: tanpa margin bawah, nilai terpilih turun baris (bukan elipsis),
     ukuran mengikuti .grow-input / .cell-dense. :global karena kelasnya milik komponen anak. */
  .cell-dd :global(.dropdown-wrapper) { margin-bottom: 0; }
  .cell-dd :global(.dropdown-trigger) {
    height: auto;
    min-height: 52px;
    padding: 14px 16px;
    line-height: 1.4;
    text-align: left;
  }
  .cell-dd :global(.dropdown-trigger > .truncate) { white-space: normal; overflow-wrap: anywhere; }
  .cell-dd :global(.dropdown-trigger.invalid) { border-color: var(--error); }
  .cell-dd.dense { min-width: var(--cell-min, 0); }
  .cell-dd.dense :global(.dropdown-trigger) { min-height: 32px; padding: 5px 6px; gap: 4px; font-size: 14px; line-height: 20px; }
  @media (pointer: coarse) {
    .cell-dd.dense { min-width: calc(var(--cell-min, 0px) * 1.15); }
    .cell-dd.dense :global(.dropdown-trigger) { min-height: 44px; font-size: 16px; }
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
