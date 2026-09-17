<script>
  import '../app.css'
  import { env } from '$env/dynamic/public'
  import { page } from '$app/state'
  import {
    PLATFORM_OG_IMAGE_PATH,
    isRespondentRoute,
    resolveFaviconUrl,
    shouldEmitPlatformOgTags,
    toAbsoluteUrl,
  } from '$lib/branding.js'
  import { resolveMediaUrl } from '$lib/mediaUrl.js'

  let { children } = $props()

  // OG/Twitter image needs an absolute URL (crawlers). Built from PUBLIC_SITE_URL
  // so the domain is env-driven, not hardcoded. Dynamic env = safe when unset.
  //
  // Gambar bawaannya kini `og-default.png` (1200×630), bukan lagi wordmark
  // 229×35 yang ditolak WhatsApp/Facebook karena di bawah ambang 200×200 —
  // itulah sebab pratinjau tautan selama ini kosong.
  //
  // 🔴 Aturan cadangan basisnya WAJIB sama dengan halaman survei
  // (`s/[slug]/+page.svelte`): origin permintaan saat PUBLIC_SITE_URL kosong.
  // Basis kosong menghasilkan `og:image` relatif, dan crawler tidak
  // mengurainya — kegagalan yang sama persis dengan yang modul ini perbaiki.
  const ogImage = $derived(
    toAbsoluteUrl(PLATFORM_OG_IMAGE_PATH, env.PUBLIC_SITE_URL || page.url.origin),
  )

  // 🔴 Satu-satunya `<link rel="icon">` di seluruh dokumen.
  //
  // (`app.html` masih memuat `<link rel="manifest">`, dan manifes PWA punya
  // ikon pemasangannya sendiri — itu ikon layar utama, bukan ikon tab.)
  //
  // app.html sengaja tidak lagi mendeklarasikan rantai ikonnya. SvelteKit hanya
  // MENGGABUNG isi `<svelte:head>` tanpa deduplikasi, jadi ikon per-survei akan
  // BERDAMPINGAN dengan ikon platform, bukan menggantikannya — dan peramban
  // tidak menjamin deklarasi yang belakangan menang (Spike S-1: Chrome tetap
  // mengambil favicon.ico platform meski ikon survei dideklarasikan sesudahnya).
  // Satu tempat deklarasi menghapus ambiguitas presedensi itu seluruhnya.
  //
  // Dibatasi ke rute responden: kelima rute surveyor ikut memuat objek survei
  // ke `page.data`, dan cangkang surveyor sengaja tetap merek platform.
  //
  // 🔴 Dijadikan absolut terhadap origin API. Backend mengirim URL media relatif
  // (`/api/v1/media/…`) selama `MEDIA_CDN_URL` tidak diset — dan `href` relatif
  // di sini diselesaikan terhadap origin survey-fe, sehingga permintaan favicon
  // mendarat di SPA dan mengembalikan HTML, bukan gambar. Gejalanya: tab kosong
  // tanpa satu pun galat yang terlihat.
  const surveyFaviconUrl = $derived(
    isRespondentRoute(page.route.id)
      ? resolveMediaUrl(resolveFaviconUrl(page.data.survey?.settings))
      : null,
  )

  // Rute survei memancarkan gambar sosialnya sendiri. Tata letak diam di sana,
  // supaya dokumen hanya memuat SATU og:image/twitter:image: dua tag membuat
  // scraper yang berbeda mengambil kemunculan yang berbeda.
  const emitPlatformOgTags = $derived(shouldEmitPlatformOgTags(page.route.id))
</script>

<svelte:head>
  {#if surveyFaviconUrl}
    <!-- `apple-touch-icon` sengaja ikut hilang di sini: responden yang
         memasang survei ke layar utama iOS lebih baik mendapat cuplikan layar
         daripada logo platform yang bukan merek survei ini. Merek survei
         menang utuh, bukan setengah. -->
    <link rel="icon" href={surveyFaviconUrl} />
  {:else}
    <!-- Rantai ikon platform, dipindahkan apa adanya dari app.html.
         Path ditulis dari akar: proyek ini tidak menyetel `paths.assets`
         (svelte.config.js), jadi `%sveltekit.assets%` memang kosong. -->
    <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
    <link rel="icon" type="image/png" sizes="96x96" href="/icons/favicon-96x96.png" />
    <link rel="icon" type="image/x-icon" href="/icons/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
  {/if}

  {#if emitPlatformOgTags}
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:image" content={ogImage} />
    <!-- Sepadan dengan gambar bawaan 1200×630. `summary` merender thumbnail
         kecil persegi, yang justru membuang perbaikan yang baru dibayar. -->
    <meta name="twitter:card" content="summary_large_image" />
  {/if}
</svelte:head>

{@render children()}
