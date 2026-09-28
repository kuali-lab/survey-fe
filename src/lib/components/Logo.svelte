<script lang="ts">
  import { isCustomLogo, resolveLogoUrl } from '$lib/branding.js'
  import { resolveMediaUrl } from '$lib/mediaUrl.js'

  let {
    height = 28,
    logoUrl = null,
  }: {
    height?: number
    /**
     * Logo per survei (M2/K29). Bersifat ADITIF: bawaannya `null`, dan `null`
     * tetap merender SVG platform yang sudah ada. Komponen ini dipakai 10
     * berkas dan lima di antaranya sengaja tetap merek platform (cangkang
     * surveyor, halaman awal situs, penampil berkas), jadi pemanggil lama nol
     * perubahan perilaku sampai ada yang benar-benar mengoper logo.
     */
    logoUrl?: string | null
  } = $props()

  // Keputusan "logo survei atau logo platform" tetap milik `branding.ts`, satu
  // tempat untuk seluruh aturan cadangan. `src` dan teks alternatif lahir dari
  // cabang yang sama, jadi keduanya tidak bisa menyimpang secara konstruksi.
  // URL media dijadikan absolut LEBIH DULU, sekali, lalu dipakai kedua cabang.
  // Backend mengirimnya relatif saat CDN tidak diset, dan URL relatif di sini
  // akan diselesaikan terhadap origin survey-fe — bukan origin API.
  const logoMedia = $derived(resolveMediaUrl(logoUrl))
  const isCustom = $derived(isCustomLogo(logoMedia))
  const logoSrc = $derived(resolveLogoUrl(logoMedia))
</script>

{#if isCustom}
  <!-- Kotak terbatas dengan rasio yang SAMA dengan halaman pembuka/penutup
       (140×36 ≈ 3,9:1), diskalakan ke tinggi yang diminta pemanggil. Tanpa batas
       lebar, logo yang sangat lebar melar melewati cangkang halaman gerbang;
       tanpa lebar tetap, logo kecil tampil mungil alih-alih memenuhi ruangnya.
       Gaya ditulis inline karena aturannya diturunkan dari prop `height` — satu
       ekspresi, bukan tabel kelas yang harus dijaga sinkron dengan prop. -->
  <!-- Atribut `height` DIPERTAHANKAN di samping `style`: ia kontrak yang sudah
       dipakai pemanggil (dan dikunci uji), dan ia memberi peramban tinggi
       intrinsik sebelum CSS terpasang — tanpa itu tata letak melompat saat muat.
       `style` yang menentukan hasil akhirnya. -->
  <img
    src={logoSrc}
    alt="Logo survei"
    {height}
    style="width: {Math.round(height * 3.9)}px; height: {height}px; object-fit: contain; object-position: left center; display: block;"
  />
<!-- 🔴 Merek platform LAMA ("Logika Teta", 173×35). SVG inline di sini masih
     menggambar artwork lama itu walau `aria-label`-nya sudah "Logika Statistik"
     — teks aksesibilitas diperbarui, gambarnya tidak, jadi visualnya tetap
     merek lama di kesepuluh pemanggil komponen ini. Ditambal dengan memakai
     aset statis yang sama dengan halaman pembuka/penutup (`/logo-logika-teta.svg`,
     229×35 — merek saat ini), bukan menambal path SVG-nya satu per satu. -->
{:else}
<img
  src="/logo-logika-teta.svg"
  alt="Logika Statistik"
  {height}
  style="width: {Math.round(height * (229 / 35))}px; height: {height}px; object-fit: contain; object-position: left center; display: block;"
/>
{/if}
