<script lang="ts">
  import type { Question, AnswerValue, Answers } from '$lib/types.js'
  import QuestionInput from './QuestionInput.svelte'
  import {
    canAddCard,
    canAddRow,
    effectiveMaxCards,
    effectiveMaxRepeat,
    isRepeatGroup,
    questionRepeats,
    toCards,
    toRows,
  } from '$lib/repeat.js'

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
    pratinjau = false,
    // 🔴 Diteruskan, tidak ditafsirkan. `paged` milik Top of Mind (dev lain) dan
    // dikirim `QuestionCard` untuk `QuestionInput` — komponen ini cuma kebetulan
    // berdiri di antaranya.
    //
    // Tanpa baris ini prop itu MATI di perbatasan sini: `QuestionInput` selalu
    // menerima `false`, cabang `{#if paged && tomStage === 2}` tidak pernah
    // menyala, dan mode satu-soal-per-halaman Top of Mind patah tanpa satu pun
    // galat. Komponen ini lahir sesudah `paged` ada di `dev`, jadi git
    // menggabungkan keduanya bersih — celahnya hanya terlihat dari svelte-check.
    paged = false
  }: {
    question: Question
    value: AnswerValue
    onChange: (v: AnswerValue) => void
    onBlur?: () => void
    slug?: string
    answers?: Answers
    questions?: Question[]
    pratinjau?: boolean
    paged?: boolean
  } = $props()

  const berulang = $derived(questionRepeats(question))
  const rows = $derived(toRows(value))
  const batas = $derived(effectiveMaxRepeat(question))

  // Repeat group (Ihatec M5): yang berulang KARTU-nya, bukan satu nilai.
  const grup = $derived(isRepeatGroup(question))
  const cards = $derived(toCards(value))
  const batasKartu = $derived(effectiveMaxCards(question))
  // Tata letak isian, diset pembuat survei. Apa pun selain 2 dibaca 1: nilai
  // asing dari klien lain tidak boleh melahirkan grid yang tidak pernah
  // dirancang, dan di layar sempit grid-nya tetap runtuh jadi satu kolom.
  const kolomKartu = $derived(question.fieldsPerRow === 2 ? 2 : 1)

  // 🔴 Kartu diganti UTUH, bukan disunting di tempat. Objek kartu ikut menjadi
  // nilai jawaban yang dikirim ke atas; memutasinya langsung membuat Svelte tidak
  // melihat perubahan, dan jawaban yang tampil di layar bisa berbeda dari yang
  // benar-benar terkirim.
  function ubahField(kartuIdx: number, fieldId: string, v: AnswerValue) {
    const teks = typeof v === 'string' ? v : v == null ? '' : String(v)
    onChange(cards.map((k, i) => (i === kartuIdx ? { ...k, [fieldId]: teks } : k)))
  }

  function tambahKartu() {
    onChange([...cards, {}])
  }

  function hapusKartu(i: number) {
    const sisa = cards.filter((_, idx) => idx !== i)
    // Selalu sisakan satu kartu — nol kartu berarti tidak ada tempat mengisi.
    onChange(sisa.length > 0 ? sisa : [{}])
  }

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

{#if grup}
  <!-- Repeat group: satu KARTU berisi seluruh field, dan kartunya yang ditambah.
       Field dirender lewat `QuestionInput` yang sama seperti pertanyaan biasa,
       jadi aturan per-tipe (placeholder, batas panjang) berlaku apa adanya. -->
  <div class="repeat-group">
    {#each cards as kartu, ci (ci)}
      <div class="kartu">
        <div class="kartu-head">
          <span class="kartu-no">{ci + 1}</span>
          {#if cards.length > 1}
            <button
              type="button"
              class="repeat-remove"
              onclick={() => hapusKartu(ci)}
              aria-label="Hapus jawaban ke-{ci + 1}"
            >
              &times;
            </button>
          {/if}
        </div>
        <div class="kartu-grid" style="--kolom-kartu: {kolomKartu}">
          {#each question.fields ?? [] as f (f.id)}
            <div class="kartu-field">
              <span class="kartu-label">{f.titlePlain || f.title}</span>
              <QuestionInput
                question={f}
                value={kartu[f.id] ?? ''}
                onChange={(v) => ubahField(ci, f.id, v)}
                {onBlur}
                {slug}
                {answers}
                {questions}
                {pratinjau}
                {paged}
              />
            </div>
          {/each}
        </div>
      </div>
    {/each}

    {#if canAddCard(question, cards)}
      <button type="button" class="repeat-add" onclick={tambahKartu}>+ Tambah jawaban</button>
    {:else}
      <p class="repeat-limit">Maksimal {batasKartu} jawaban.</p>
    {/if}
  </div>
{:else if berulang}
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
            {paged}
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
  <QuestionInput {question} {value} {onChange} {onBlur} {slug} {answers} {questions} {pratinjau} {paged} />
{/if}

<style>
  /* Repeat group: satu kartu = satu record. Bingkainya sengaja terlihat —
     tanpa batas visual, empat field dua kartu terbaca sebagai delapan isian
     lepas, dan responden kehilangan jejak kendaraan mana yang sedang diisi. */
  .kartu {
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 12px;
    padding: 12px 14px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--surface, #fff);
  }

  .kartu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  /* Nomor kartu, bukan nomor soal. Pertanyaannya tetap satu. */
  .kartu-no {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    border-radius: 999px;
    background: var(--canvas, #f3f4f6);
    font-size: 12px;
    font-weight: 600;
    color: var(--muted, #6b7280);
  }

  /* Tata letak isian, diset pembuat survei (1 atau 2 kolom).
     🔴 `minmax(0, 1fr)`, bukan `1fr`: bawaan grid adalah `min-width: auto`,
     jadi satu isian berisi teks panjang tanpa spasi akan MELEBARKAN kolomnya
     dan mendorong kartu melewati tepi layar — tanpa galat, hanya scroll
     horizontal yang tiba-tiba ada di ponsel. */
  .kartu-grid {
    display: grid;
    grid-template-columns: repeat(var(--kolom-kartu, 1), minmax(0, 1fr));
    gap: 10px;
  }

  /* Di layar sempit dua kolom selalu terlalu sesak untuk kotak teks, berapa pun
     yang dipilih pembuat survei. Runtuh jadi satu kolom. */
  @media (max-width: 520px) {
    .kartu-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .kartu-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .kartu-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted, #6b7280);
  }

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
