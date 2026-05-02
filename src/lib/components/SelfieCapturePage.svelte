<script lang="ts">
  import Logo from './Logo.svelte'
  import { onDestroy } from 'svelte'

  let {
    onComplete,
    onDenied,
    loading = false
  }: {
    onComplete: (imageBase64: string) => void
    onDenied: () => void
    loading?: boolean
  } = $props()

  type Stage = 'intro' | 'requesting' | 'streaming' | 'captured'

  let stage = $state<Stage>('intro')
  let videoEl = $state<HTMLVideoElement | null>(null)
  let stream: MediaStream | null = null
  let capturedDataUrl = $state<string | null>(null)
  let errorMsg = $state<string | null>(null)

  async function startCamera() {
    errorMsg = null
    stage = 'requesting'
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      stream = ms
      stage = 'streaming'
      // wait a tick for video element to mount
      await Promise.resolve()
      if (videoEl) {
        videoEl.srcObject = ms
        await videoEl.play().catch(() => {})
      }
    } catch (err) {
      stage = 'intro'
      const e = err as DOMException
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        onDenied()
        return
      }
      if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        errorMsg = 'Kamera tidak ditemukan pada perangkat ini.'
        return
      }
      if (e?.name === 'NotReadableError' || e?.name === 'TrackStartError') {
        errorMsg = 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.'
        return
      }
      errorMsg = 'Tidak dapat mengakses kamera. Pastikan perangkat Anda mendukung kamera.'
    }
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop())
      stream = null
    }
    if (videoEl) videoEl.srcObject = null
  }

  function takePhoto() {
    if (!videoEl || !stream) return
    const vw = videoEl.videoWidth
    const vh = videoEl.videoHeight
    if (!vw || !vh) return

    // Resize to max 800px on the long edge for ~150KB JPEG.
    const maxEdge = 800
    const scale = Math.min(1, maxEdge / Math.max(vw, vh))
    const cw = Math.round(vw * scale)
    const ch = Math.round(vh * scale)

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Draw un-mirrored (the CSS scaleX(-1) on <video> only affects the preview).
    ctx.drawImage(videoEl, 0, 0, cw, ch)
    capturedDataUrl = canvas.toDataURL('image/jpeg', 0.7)
    stage = 'captured'
  }

  function retake() {
    capturedDataUrl = null
    stage = 'streaming'
  }

  function confirm() {
    if (!capturedDataUrl) return
    stopStream()
    onComplete(capturedDataUrl)
  }

  onDestroy(() => stopStream())
</script>

<div class="card">
  <div class="logo-bar">
    <Logo height={24} />
    <span class="title-pill">Foto Selfie</span>
  </div>

  {#if stage === 'intro'}
    <div class="intro-icon-wrap">
      <div class="icon-circle">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M9 4h6l1.5 2H20a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h3.5L9 4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.6"/>
        </svg>
      </div>
    </div>
    <div class="body">
      <h1 class="title">Hampir selesai</h1>
      <p class="description">
        Untuk verifikasi keaslian responden, kami memerlukan satu foto selfie Anda.
      </p>

      {#if errorMsg}
        <div class="error-msg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1" fill="currentColor"/>
          </svg>
          <span>{errorMsg}</span>
        </div>
      {/if}

      <button class="cta" onclick={startCamera} disabled={loading}>
        Mulai Foto Selfie
      </button>
    </div>

  {:else}
    <div class="camera-stage">
      {#if stage === 'captured' && capturedDataUrl}
        <img class="cam-frozen" src={capturedDataUrl} alt="Selfie hasil" />
      {:else}
        <video bind:this={videoEl} class="cam-video" autoplay playsinline muted></video>
      {/if}

      <!-- Spotlight mask + oval guide. Percentages reference the parent SVG viewport. -->
      <svg class="overlay" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="selfie-oval-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <ellipse cx="50%" cy="44%" rx="34%" ry="28%" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#selfie-oval-mask)" />
        <ellipse
          cx="50%" cy="44%" rx="34%" ry="28%"
          fill="none" stroke="white" stroke-width="2" stroke-opacity="0.9"
        />
      </svg>

      {#if stage === 'requesting'}
        <div class="loading">
          <span class="spinner-lg" aria-hidden="true"></span>
          <span>Mengaktifkan kamera…</span>
        </div>
      {/if}
    </div>

    {#if stage === 'streaming'}
      <div class="hint">Posisikan wajah dalam bingkai</div>
      <ul class="tips">
        <li><span class="check">✓</span> Wajah terlihat jelas dan terang</li>
        <li><span class="check">✓</span> Lepas masker dan kacamata gelap</li>
        <li><span class="check">✓</span> Hindari cahaya dari belakang</li>
      </ul>
      <div class="controls">
        <button class="shutter" onclick={takePhoto} aria-label="Ambil foto">
          <span class="shutter-inner"></span>
        </button>
      </div>
    {:else if stage === 'captured'}
      <div class="hint">Pastikan wajah terlihat jelas</div>
      <div class="controls confirm-row">
        <button class="btn-secondary" onclick={retake} disabled={loading}>
          Ambil ulang
        </button>
        <button class="btn-primary" onclick={confirm} disabled={loading}>
          {#if loading}
            <span class="spinner" aria-hidden="true"></span>
            Mengirim…
          {:else}
            Pakai foto ini
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .card {
    background: white;
    border-radius: var(--radius-xl);
    max-width: 520px;
    width: 100%;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .logo-bar {
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--tertiary-20, #f0f0ec);
  }

  .title-pill {
    font-size: 13px;
    font-weight: 700;
    color: var(--tertiary-90);
    background: var(--tertiary-10, #f7f7f4);
    padding: 4px 10px;
    border-radius: 999px;
  }

  .intro-icon-wrap {
    display: flex;
    justify-content: center;
    padding: 32px 32px 0;
  }

  .icon-circle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary-10, #fff7d6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary-50, #f7bb00);
  }

  .body {
    padding: 24px 32px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
  }

  .title {
    font-size: 24px;
    font-weight: 700;
    color: var(--tertiary-100);
    line-height: 1.3;
  }

  .description {
    font-size: 15px;
    color: var(--tertiary-70);
    line-height: 1.6;
    max-width: 90%;
  }

  .cta {
    width: 100%;
    background: var(--primary-50);
    color: #221500;
    font-family: var(--font);
    font-size: 16px;
    font-weight: 700;
    border: none;
    border-radius: var(--radius-xl);
    padding: 16px 28px;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-top: 8px;
  }

  .cta:hover:not(:disabled) { background: #e8ae00; }
  .cta:active:not(:disabled) { transform: scale(0.98); }
  .cta:disabled { opacity: 0.7; cursor: not-allowed; }

  .error-msg {
    display: flex;
    align-items: flex-start;
    text-align: left;
    gap: 8px;
    background: #fee2e2;
    color: #dc2626;
    padding: 12px 16px;
    border-radius: var(--radius-lg);
    font-size: 13.5px;
    font-weight: 500;
    width: 100%;
  }

  .camera-stage {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background: #000;
    overflow: hidden;
  }

  .cam-video,
  .cam-frozen {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Mirror the live preview so it feels like a real mirror to the user.
       The captured frame is drawn from the un-mirrored video stream, so the
       saved image is in correct orientation. */
    transform: scaleX(-1);
  }

  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.4);
  }

  .spinner-lg {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .hint {
    text-align: center;
    font-size: 15px;
    font-weight: 600;
    color: var(--tertiary-100);
    padding: 16px 24px 4px;
  }

  .tips {
    list-style: none;
    margin: 0;
    padding: 8px 24px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: var(--tertiary-70);
  }

  .tips li {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .check {
    color: #16a34a;
    font-weight: 800;
  }

  .controls {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px 24px 28px;
  }

  .controls.confirm-row {
    gap: 12px;
  }

  .shutter {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: white;
    border: 4px solid var(--tertiary-30, #d8d8d2);
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s, border-color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .shutter:hover { border-color: var(--primary-50); }
  .shutter:active { transform: scale(0.94); }

  .shutter-inner {
    display: block;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--primary-50, #f7bb00);
  }

  .btn-primary,
  .btn-secondary {
    flex: 1;
    font-family: var(--font);
    font-size: 15px;
    font-weight: 700;
    border-radius: var(--radius-xl);
    padding: 14px 20px;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-primary {
    background: var(--primary-50);
    color: #221500;
  }
  .btn-primary:hover:not(:disabled) { background: #e8ae00; }
  .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

  .btn-secondary {
    background: var(--tertiary-10, #f7f7f4);
    color: var(--tertiary-100);
    border: 1px solid var(--tertiary-30, #d8d8d2);
  }
  .btn-secondary:hover:not(:disabled) { background: var(--tertiary-20, #ececea); }
  .btn-secondary:disabled { opacity: 0.7; cursor: not-allowed; }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(34, 21, 0, 0.25);
    border-top-color: #221500;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
