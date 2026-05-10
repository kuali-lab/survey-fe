<script lang="ts">
  import type { PageData } from './$types.js'
  import { goto } from '$app/navigation'
  import CodeInput from '$lib/components/CodeInput.svelte'
  import { surveyorLogin, saveSurveyorSession, loadSurveyorSession } from '$lib/surveyorAuth.js'
  import { onMount } from 'svelte'

  let { data }: { data: PageData } = $props()

  let code = $state('')
  let loading = $state(false)
  let error = $state<string | null>(null)

  onMount(() => {
    if (data.slug && !data.error) {
      const session = loadSurveyorSession()
      if (session && session.slug === data.slug) {
        goto(`/s/${data.slug}`, { replaceState: true })
      }
    }
  })

  async function handleSubmit() {
    if (code.length !== 6) {
      error = 'Masukkan 6 karakter kode akses.'
      return
    }
    loading = true
    error = null

    const result = await surveyorLogin(code, data.slug ?? undefined)
    loading = false

    if (!result.ok) {
      if (result.status === 401 || result.status === 403) {
        error = 'Kode tidak valid atau tidak sesuai dengan survei ini.'
      } else if (result.status === 429) {
        error = 'Terlalu banyak percobaan. Coba lagi dalam beberapa saat.'
      } else {
        error = 'Terjadi kesalahan. Silakan coba lagi.'
      }
      return
    }

    saveSurveyorSession(result.session)
    goto(`/s/${data.slug}`, { replaceState: true })
  }
</script>

<div class="min-h-dvh bg-[var(--tertiary-20,#f5f5f2)] flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-lg max-w-sm w-full p-8 flex flex-col gap-6">
    <div class="text-center">
      <p class="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Mode Petugas Survei</p>
      {#if data.error === 'not_found'}
        <h1 class="text-lg font-bold text-gray-900">Survei tidak ditemukan</h1>
        <p class="text-sm text-gray-500 mt-1">Tautan tidak valid atau survei sudah dihapus.</p>
      {:else if data.error === 'survey_closed'}
        <h1 class="text-lg font-bold text-gray-900">Survei sudah ditutup</h1>
        <p class="text-sm text-gray-500 mt-1">Survei ini tidak lagi menerima jawaban.</p>
      {:else}
        <h1 class="text-lg font-bold text-gray-900">{data.survey?.title ?? 'Survei'}</h1>
        <p class="text-sm text-gray-500 mt-1">Masukkan kode akses 6 karakter Anda</p>
      {/if}
    </div>

    {#if !data.error}
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
    {/if}
  </div>
</div>
