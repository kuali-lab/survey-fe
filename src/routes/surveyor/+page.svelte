<script lang="ts">
  import { goto } from '$app/navigation'
  import CodeInput from '$lib/components/CodeInput.svelte'
  import Logo from '$lib/components/Logo.svelte'
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
    goto(`/surveyor/s/${result.session.slug}/ready`, { replaceState: true })
  }
</script>

<svelte:head>
  <title>Masuk Petugas · Logika Statistik</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
  <div class="card">
    <div class="head">
      <Logo />
      <span class="chip">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="4" y="6" width="16" height="14" rx="2" />
          <line x1="9" y1="3" x2="9" y2="6" />
          <line x1="15" y1="3" x2="15" y2="6" />
          <line x1="8" y1="11" x2="16" y2="11" />
          <line x1="8" y1="15" x2="13" y2="15" />
        </svg>
        Mode Petugas Survei
      </span>
      <h1 class="title">Masukkan Kode Akses</h1>
      <p class="sub">Gunakan kode akses 6 karakter dari email undangan.</p>
    </div>

    <CodeInput value={code} onchange={(v) => { code = v; error = null }} disabled={loading} autofocus />

    {#if error}
      <p class="error-msg">{error}</p>
    {/if}

    <button onclick={handleSubmit} disabled={loading || code.length !== 6} class="cta">
      {loading ? 'Memverifikasi…' : 'Masuk →'}
    </button>

    <div class="foot">
      Tidak menerima kode? Periksa folder spam atau hubungi pemilik survei.
    </div>
  </div>
</div>

<style>
  .page {
    min-height: 100dvh;
    background: var(--tertiary-20);
    background-image: radial-gradient(ellipse at top, rgba(247, 187, 0, 0.12), transparent 55%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
  }

  .card {
    background: white;
    border-radius: var(--radius-xl);
    max-width: 420px;
    width: 100%;
    padding: 32px 28px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--primary-10);
    color: #b45309;
    border: 1px solid var(--primary-30);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .title {
    font-size: 24px;
    font-weight: 800;
    color: var(--tertiary-100);
    line-height: 1.2;
    margin: 4px 0 0;
  }

  .sub {
    font-size: 14px;
    color: var(--tertiary-70);
    line-height: 1.5;
    margin: 0;
  }

  .error-msg {
    font-size: 13.5px;
    color: var(--error-50);
    text-align: center;
    margin-top: -4px;
  }

  .cta {
    width: 100%;
    min-height: 52px;
    background: var(--primary-50);
    color: #221500;
    font-family: var(--font);
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
  }

  .cta:hover:not(:disabled) { background: #e8ae00; }
  .cta:active:not(:disabled) { transform: scale(0.98); }
  .cta:disabled { opacity: 0.5; cursor: not-allowed; }

  .foot {
    border-top: 1px solid var(--tertiary-30);
    padding-top: 14px;
    font-size: 13px;
    color: var(--tertiary-70);
    line-height: 1.5;
    text-align: center;
  }
</style>
