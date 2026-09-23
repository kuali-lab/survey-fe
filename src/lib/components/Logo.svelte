<script lang="ts">
  let { height = 28 }: { height?: number } = $props()
</script>

<!-- 🔴 Merek platform LAMA ("Logika Teta", 173×35). SVG inline di sini masih
     menggambar artwork lama itu walau `aria-label`-nya sudah "Logika Statistik"
     — teks aksesibilitas diperbarui, gambarnya tidak, jadi visualnya tetap
     merek lama di kesepuluh pemanggil komponen ini. Ditambal dengan memakai
     aset statis yang sama dengan halaman pembuka/penutup (`/logo-logika-teta.svg`,
     229×35 — merek saat ini), bukan menambal path SVG-nya satu per satu. -->
<img
  src="/logo-logika-teta.svg"
  alt="Logika Statistik"
  {height}
  style="width: {Math.round(height * (229 / 35))}px; height: {height}px; object-fit: contain; object-position: left center; display: block;"
/>
