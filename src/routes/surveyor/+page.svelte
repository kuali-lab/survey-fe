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

<div class="page">
  <div class="card">
    <div class="header">
      <p class="badge">Mode Petugas Survei</p>
      <h1 class="title">Masukkan Kode Akses</h1>
      <p class="subtitle">Gunakan kode akses dari email undangan Anda</p>
    </div>

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
