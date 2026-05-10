<script lang="ts">
  import { goto } from '$app/navigation'
  import CodeInput from '$lib/components/CodeInput.svelte'
  import { surveyorLogin, saveSurveyorSession } from '$lib/surveyorAuth.js'

  let code = $state('')
  let loading = $state(false)
  let error = $state<string | null>(null)

  async function handleSubmit() {
    if (code.length !== 6) {
      error = 'Masukkan 6 karakter kode akses.'
      return
    }
    loading = true
    error = null

    const result = await surveyorLogin(code)
    loading = false

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        error = 'Kode akses tidak valid atau sudah tidak aktif.'
      } else if (result.status === 429) {
        error = 'Terlalu banyak percobaan. Coba lagi dalam beberapa saat.'
      } else {
        error = 'Terjadi kesalahan. Silakan coba lagi.'
      }
      return
    }

    saveSurveyorSession(result.session)
    goto(`/s/${result.session.slug}`, { replaceState: true })
  }
</script>

<div class="min-h-dvh bg-[var(--tertiary-20,#f5f5f2)] flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 flex flex-col gap-6">
    <div class="text-center">
      <p class="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Mode Petugas Survei</p>
      <h1 class="text-lg font-bold text-gray-900">Masukkan Kode Akses</h1>
      <p class="text-sm text-gray-500 mt-1">Gunakan kode akses dari email undangan Anda</p>
    </div>

    <CodeInput value={code} onchange={(v) => { code = v; error = null }} disabled={loading} autofocus />

    {#if error}
      <p class="text-sm text-red-600 text-center -mt-2">{error}</p>
    {/if}

    <button
      onclick={handleSubmit}
      disabled={loading || code.length !== 6}
      class="w-full py-3 px-6 rounded-xl bg-amber-400 text-gray-900 font-bold text-sm hover:bg-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Memverifikasi…' : 'Masuk'}
    </button>
  </div>
</div>
