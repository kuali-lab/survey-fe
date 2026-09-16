// Test stand-in for SvelteKit's `$app/state` virtual module (aliased di
// vitest.config.ts). Bentuknya sengaja dibuat bisa diubah: uji tata letak akar
// perlu merender rute yang berbeda-beda, dan `page.route.id`-lah yang
// menentukan apakah tag OG bawaan platform ikut dipancarkan.
//
// Tidak pernah diimpor kode aplikasi.
export const page: { route: { id: string | null }, data: Record<string, unknown> } = {
  route: { id: null },
  data: {},
}
