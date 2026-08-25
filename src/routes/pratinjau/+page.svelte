<!--
  Pratinjau draf survei AI (Fase 7 batch 2, Tugas 6).

  🔴 **Nol pengiriman, dan itu STRUKTURAL.** Halaman ini tidak memanggil satu
  pun endpoint tulis — bukan "memanggil lalu ditolak", tapi tidak punya jalurnya
  sama sekali. Yang menjaganya bukan janji di komentar ini:

    · `SurveyRunner` dibuat dengan `onFinish` yang cuma memindahkan layar;
    · draf tidak punya slug, jadi endpoint kirim jawaban — yang menyelesaikan
      survei LEWAT SLUG sebelum mengerjakan apa pun — tidak punya yang bisa
      diselesaikan;
    · unggah berkas dimatikan lewat prop `pratinjau` di QuestionInput, supaya
      ia tidak menembak `/s//upload` yang gagal tapi tetap keluar;
    · nol `localStorage`: menyimpan jawaban pratinjau berarti percobaan pemilik
      draf muncul lagi di perangkat yang sama nanti, terbaca seperti draf
      responden sungguhan.

  🔴 **Perendernya SAMA PERSIS dengan responden**: `SurveyStage` yang dipakai
  `routes/s/[slug]` yang sama, `SurveyRunner` yang sama, `QuestionCard` yang
  sama. Kalau suatu hari pertanyaan tampil beda di sini, itu bug di satu tempat,
  bukan dua tampilan yang menyimpang pelan-pelan.

  Yang MEMANG berbeda cuma dua, dan keduanya disengaja: penanda "pratinjau" yang
  selalu terlihat, dan layar akhir yang mengajak mengulang alih-alih berterima
  kasih atas jawaban yang tidak pernah dikirim.
-->
<script lang="ts">
  import type { PageData } from './$types.js'
  import { onMount } from 'svelte'
  import WelcomePage from '$lib/components/WelcomePage.svelte'
  import ClosingPage from '$lib/components/ClosingPage.svelte'
  import SurveyStage from '$lib/components/SurveyStage.svelte'
  import { SurveyRunner } from '$lib/runner/SurveyRunner.svelte.js'

  let { data }: { data: PageData } = $props()

  const survey = $derived(data.survey)

  type Layar = 'error' | 'welcome' | 'question' | 'closing'
  // Dibungkus fungsi, bukan dibaca langsung: `$state(data.survey ? …)` cuma
  // menangkap nilai AWAL `data`, dan svelte-check memperingatkannya.
  function layarAwal(): Layar {
    return data.survey ? 'welcome' : 'error'
  }
  let layar = $state<Layar>(layarAwal())
  let prefersReducedMotion = $state(false)

  const runner = new SurveyRunner({
    getSurvey: () => survey ?? null,
    // Tombol halaman terakhir memindahkan layar, titik. Di halaman responden
    // ia membuka dialog konfirmasi kirim; di sini tidak ada yang dikirim, jadi
    // tidak ada yang perlu dikonfirmasi.
    onFinish: () => { layar = 'closing' },
    autoSubmit: false,
  })

  const questionErrors = $derived(runner.questionErrors)
  const welcomeQuestion = $derived(
    survey?.questions.find((q) => q.type === 'welcome_page') ?? null,
  )
  const closingQuestion = $derived(
    survey?.questions.find((q) => q.type === 'closing_page') ?? null,
  )
  const settings = $derived(
    survey?.settings ?? {
      showProgress: true,
      showBranding: true,
      showNavArrows: true,
      showNumbers: true,
      displayMode: 'one_per_page' as const,
    },
  )

  const pesanGalat = $derived(
    data.error === 'preview_invalid'
      ? 'Tautan pratinjau tidak berlaku lagi. Buka ulang pratinjaunya dari percakapan.'
      : data.error === 'not_found'
        ? 'Draf survei ini tidak ditemukan.'
        : 'Pratinjau tidak bisa dimuat sekarang.',
  )

  function mulai() {
    runner.reset()
    layar = 'question'
  }

  onMount(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion = mq.matches
    const onChange = (e: MediaQueryListEvent) => { prefersReducedMotion = e.matches }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  })
</script>

<svelte:head>
  <title>Pratinjau draf survei</title>
  <!-- Pratinjau tidak boleh terindeks: isinya draf milik satu orang, dan
       tautannya mati dalam hitungan menit. -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Penanda yang SELALU terlihat, bukan cuma di layar pertama. Pengguna yang
     menggulir jauh ke dalam survei harus tetap tahu ia sedang melihat
     pratinjau — kalau tidak, ia mengira sudah mengisi survei sungguhan. -->
<div class="pita-pratinjau" role="status">
  Pratinjau draf — jawaban tidak disimpan
</div>

<div class="isi">
  {#if layar === 'error'}
    <!-- Kartu sendiri, bukan `ErrorPage`: komponen itu punya kalimat tetap
         untuk survei publik ("tautan survei tidak valid atau survei sudah
         dihapus"), dan kalimat itu keliru untuk pratinjau yang tokennya
         sekadar kedaluwarsa. Memaksanya menerima pesan bebas mengubah
         komponen yang dipakai responden demi keperluan halaman ini. -->
    <div class="tengah">
      <div class="kartu-galat" role="alert">
        <p>{pesanGalat}</p>
      </div>
    </div>

  {:else if layar === 'welcome'}
    <div class="tengah">
      <WelcomePage
        title={welcomeQuestion?.title || survey?.title || ''}
        titlePlain={welcomeQuestion?.titlePlain || survey?.title || ''}
        description={welcomeQuestion?.description ?? null}
        imageUrl={welcomeQuestion?.imageUrl ?? null}
        imageLayout={welcomeQuestion?.imageLayout ?? 'center'}
        ctaText={'Mulai Pratinjau'}
        onStart={mulai}
      />
    </div>

  {:else if layar === 'question'}
    <SurveyStage
      {runner}
      {settings}
      {questionErrors}
      {prefersReducedMotion}
      pratinjau
    />

  {:else if layar === 'closing'}
    <div class="tengah">
      <ClosingPage
        title={closingQuestion?.title || 'Ini akhir surveinya'}
        titlePlain={closingQuestion?.titlePlain || 'Ini akhir surveinya'}
        description={closingQuestion?.description
          ?? 'Sampai di sini yang akan dilihat responden. Jawaban pratinjau tidak dikirim ke mana pun.'}
        imageUrl={closingQuestion?.imageUrl ?? null}
        imageLayout={closingQuestion?.imageLayout ?? 'center'}
      />
      <button class="ulangi" type="button" onclick={mulai}>Ulangi dari awal</button>
    </div>
  {/if}
</div>

<style>
  .pita-pratinjau {
    position: sticky;
    top: 0;
    z-index: 20;
    text-align: center;
    padding: 6px 12px;
    font-size: 13px;
    font-weight: 600;
    background: var(--canvas-soft);
    color: var(--text-body);
    border-bottom: 1px solid var(--canvas-soft);
  }

  .isi {
    /* Pitanya memakan tinggi; tanpa ini panggung setinggi 100dvh membuat
       halaman punya penggulir sebesar tinggi pita di setiap pertanyaan. */
    min-height: calc(100dvh - 30px);
  }

  .tengah {
    min-height: calc(100dvh - 30px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    gap: 12px;
  }

  .ulangi {
    border: 1px solid var(--canvas-soft);
    background: var(--canvas);
    color: var(--text-body);
    border-radius: var(--radius-input);
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .ulangi:hover {
    border-color: var(--ink);
  }

  .kartu-galat {
    max-width: 420px;
    text-align: center;
    background: var(--canvas);
    border: 1px solid var(--canvas-soft);
    border-radius: var(--radius-card);
    padding: 24px;
    font-size: 15px;
    color: var(--text-body);
  }
</style>
