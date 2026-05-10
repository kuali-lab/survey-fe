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

<div class="page">
  <div class="card">
    <div class="header">
      <p class="badge">Mode Petugas Survei</p>
      {#if data.error === 'not_found'}
        <h1 class="title">Survei tidak ditemukan</h1>
        <p class="subtitle">Tautan tidak valid atau survei sudah dihapus.</p>
      {:else if data.error === 'survey_closed'}
        <h1 class="title">Survei sudah ditutup</h1>
        <p class="subtitle">Survei ini tidak lagi menerima jawaban.</p>
      {:else}
        <h1 class="title">{data.survey?.title ?? 'Survei'}</h1>
        <p class="subtitle">Masukkan kode akses 6 karakter Anda</p>
      {/if}
    </div>

    {#if !data.error}
      <CodeInput value={code} onchange={(v) => { code = v; error = null }} disabled={loading} autofocus />

      {#if error}
        <p class="error-msg">{error}</p>
      {/if}

      <button
        onclick={handleSubmit}
        disabled={loading || code.length !== 6}
        class="cta"
      >
        {loading ? 'Memverifikasi…' : 'Masuk'}
      </button>
    {/if}
  </div>
</div>

<style>
  .page {
    min-height: 100dvh;
    background: var(--tertiary-20);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .card {
    background: white;
    border-radius: var(--radius-xl);
    max-width: 400px;
    width: 100%;
    padding: 32px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .header {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .badge {
    font-size: 11px;
    font-weight: 700;
    color: #b45309;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .title {
    font-size: 20px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.3;
  }

  .subtitle {
    font-size: 14px;
    color: var(--tertiary-70);
    line-height: 1.5;
  }

  .error-msg {
    font-size: 14px;
    color: var(--error-50);
    text-align: center;
    margin-top: -8px;
  }

  .cta {
    width: 100%;
    height: 48px;
    background: var(--primary-50);
    color: #221500;
    font-family: var(--font);
    font-size: 15px;
    font-weight: 700;
    border: none;
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
  }

  .cta:hover:not(:disabled) {
    background: #e8ae00;
  }

  .cta:active:not(:disabled) {
    transform: scale(0.98);
  }

  .cta:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
