<script lang="ts">
  import type { Question, AnswerValue, Answers } from '$lib/types.js'
  import QuestionInput from './QuestionInput.svelte'
  import { canAddRow, effectiveMaxRepeat, questionRepeats, toRows } from '$lib/repeat.js'

  // Satu-satunya tugas komponen ini: memutuskan pertanyaan ini dirender sekali
  // atau berkali-kali. QuestionInput tidak diubah sama sekali — ia tetap
  // menerima SATU nilai skalar, dan di sini ia dipanggil sekali per pengulangan.
  //
  // 🔴 Nol state lokal. Barisnya DITURUNKAN dari nilai jawaban, dan tiap
  // perubahan mengirim array utuh ke atas. Kalau baris disimpan lokal, ia bisa
  // berbeda dari jawaban yang benar-benar terkirim, dan bedanya baru ketahuan
  // setelah submit.
  let {
    question,
    value,
    onChange,
    onBlur,
    slug = '',
    answers = {},
    questions = [],
    pratinjau = false
  }: {
    question: Question
    value: AnswerValue
    onChange: (v: AnswerValue) => void
    onBlur?: () => void
    slug?: string
    answers?: Answers
    questions?: Question[]
    pratinjau?: boolean
  } = $props()

  const berulang = $derived(questionRepeats(question))
  const rows = $derived(toRows(value))
  const batas = $derived(effectiveMaxRepeat(question))

  function ubahBaris(i: number, v: AnswerValue) {
    const teks = typeof v === 'string' ? v : v == null ? '' : String(v)
    onChange(rows.map((r, idx) => (idx === i ? teks : r)))
  }

  function tambah() {
    onChange([...rows, ''])
  }

  function hapus(i: number) {
    const sisa = rows.filter((_, idx) => idx !== i)
    // Selalu sisakan satu baris: nol baris berarti tidak ada tempat mengetik,
    // dan responden akan mengira pertanyaannya rusak.
    onChange(sisa.length > 0 ? sisa : [''])
  }
</script>

{#if berulang}
  <div class="repeat-group">
    {#each rows as row, i (i)}
      <div class="repeat-row">
        <div class="repeat-input">
          <QuestionInput
            {question}
            value={row}
            onChange={(v) => ubahBaris(i, v)}
            {onBlur}
            {slug}
            {answers}
            {questions}
            {pratinjau}
          />
        </div>
        {#if rows.length > 1}
          <button
            type="button"
            class="repeat-remove"
            onclick={() => hapus(i)}
            aria-label="Hapus jawaban ke-{i + 1}"
          >
            &times;
          </button>
        {/if}
      </div>
    {/each}

    {#if canAddRow(question, rows)}
      <button type="button" class="repeat-add" onclick={tambah}>+ Tambah jawaban</button>
    {:else}
      <p class="repeat-limit">Maksimal {batas} jawaban.</p>
    {/if}
  </div>
{:else}
  <QuestionInput {question} {value} {onChange} {onBlur} {slug} {answers} {questions} {pratinjau} />
{/if}

<style>
  .repeat-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .repeat-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .repeat-input {
    flex: 1;
    min-width: 0;
  }
  .repeat-remove {
    flex: 0 0 auto;
    margin-top: 4px;
    width: 32px;
    height: 32px;
    border: 1px solid var(--border, #d8dce3);
    border-radius: 8px;
    background: transparent;
    color: var(--text-body, #4a5160);
    font-size: 1.1rem;
    line-height: 1;
    cursor: pointer;
  }
  .repeat-add {
    align-self: flex-start;
    border: none;
    background: transparent;
    padding: 4px 0;
    color: var(--primary, #2563eb);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
  }
  .repeat-limit {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-body, #4a5160);
  }
</style>
