// Test stand-in for SvelteKit's `$app/state` virtual module (aliased di
// vitest.config.ts). Bentuknya sengaja dibuat bisa diubah: uji tata letak akar
// perlu merender rute yang berbeda-beda, dan `page.route.id`-lah yang
// menentukan apakah tag OG bawaan platform ikut dipancarkan.
//
// Tidak pernah diimpor kode aplikasi.
// `url` ikut distub karena tata letak akar memakainya sebagai basis cadangan
// saat PUBLIC_SITE_URL kosong — dan justru cabang itulah yang harus terbukti
// tetap menghasilkan URL absolut.
export const page: {
  route: { id: string | null }
  data: Record<string, unknown>
  url: URL
} = {
  route: { id: null },
  data: {},
  url: new URL('http://test.local/'),
}
