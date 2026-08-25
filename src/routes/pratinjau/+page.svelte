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
     pratinjau — kalau tidak, ia mengira sudah mengisi survei sungguhan.

     🔴 Pil MELAYANG di kanan atas, bukan pita selebar layar di puncak halaman
     (dilaporkan user 26 Agustus 2026). `.logo-bar` survei berposisi `fixed`
     pada `top: 24px`, jadi ia mengabaikan alur dokumen dan pita setinggi 31px
     memotong tujuh piksel teratas logonya. Pil ini duduk sebaris dengan logo
     di sisi seberang: nol tumpang tindih, dan halamannya tidak lagi perlu
     mengurangi tinggi pita dari setiap panggung. -->
<div class="pil-pratinjau" role="status">
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
  .pil-pratinjau {
    position: fixed;
    /* Sebaris dengan `.logo-bar` (fixed, top 24px) di sisi seberangnya. */
    top: 24px;
    right: 24px;
    z-index: 20;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--canvas-soft);
    color: var(--text-body);
    border: 1px solid var(--canvas-soft);
    /* Latar solid wajib: ia melayang di atas pertanyaan yang tergulir
       lewat di bawahnya, dan pil tembus pandang berubah jadi teks bertumpuk. */
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
    pointer-events: none;
  }

  /* Di panel sempit (pratinjau di dalam bingkai dashboard) pil selebar itu
     memakan seperempat lebar. Teksnya dipendekkan lewat ukuran, bukan dibuang:
     penanda yang hilang di layar sempit persis keadaan yang paling mudah
     disalahpahami sebagai survei sungguhan. */
  @media (max-width: 560px) {
    .pil-pratinjau {
      top: 12px;
      right: 12px;
      font-size: 11px;
      padding: 4px 9px;
    }
  }

  .isi {
    /* Pil melayang, jadi ia tidak lagi memakan tinggi — panggung boleh
       setinggi layar penuh. */
    min-height: 100dvh;
  }

  .tengah {
    min-height: 100dvh;
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
