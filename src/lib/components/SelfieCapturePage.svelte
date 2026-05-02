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

  // Minimal FaceDetector typing — not in lib.dom and only available in Chrome on Android.
  type FaceDetection = { boundingBox: { x: number; y: number; width: number; height: number } }
  type FaceDetectorInstance = { detect: (src: HTMLVideoElement) => Promise<FaceDetection[]> }
  type FaceDetectorCtor = new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorInstance

  let stage = $state<Stage>('intro')
  let videoEl = $state<HTMLVideoElement | null>(null)
  let stream: MediaStream | null = null
  let capturedDataUrl = $state<string | null>(null)
  let errorMsg = $state<string | null>(null)
  let faceAligned = $state(false)
  let detector: FaceDetectorInstance | null = null
  let detectTimer: ReturnType<typeof setInterval> | null = null

  // Oval geometry — kept in sync with the SVG below so face-alignment math matches the visual guide.
  const OVAL_CX = 0.5
  const OVAL_CY = 0.44
  const OVAL_RX = 0.34
  const OVAL_RY = 0.28
  const FACE_MIN_AREA = 0.05 // face must occupy ≥5% of frame to count as "close enough"

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
      await Promise.resolve()
      if (videoEl) {
        videoEl.srcObject = ms
        await videoEl.play().catch(() => {})
      }
      startFaceDetection()
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

  function startFaceDetection() {
    const FD = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector
    if (!FD) return
    try {
      detector = new FD({ fastMode: true, maxDetectedFaces: 1 })
    } catch {
      detector = null
      return
    }
    detectTimer = setInterval(runDetection, 400)
  }

  async function runDetection() {
    if (!detector || !videoEl || stage !== 'streaming') return
    const vw = videoEl.videoWidth
    const vh = videoEl.videoHeight
    if (!vw || !vh) return
    try {
      const faces = await detector.detect(videoEl)
      if (faces.length === 0) {
        faceAligned = false
        return
      }
      const bb = faces[0].boundingBox
      // Front camera output is un-mirrored. The oval is symmetric horizontally,
      // so we don't need to flip the math even though the preview is mirrored.
      const fx = (bb.x + bb.width / 2) / vw
      const fy = (bb.y + bb.height / 2) / vh
      const dx = (fx - OVAL_CX) / OVAL_RX
      const dy = (fy - OVAL_CY) / OVAL_RY
      const inside = (dx * dx + dy * dy) <= 1
      const area = (bb.width / vw) * (bb.height / vh)
      faceAligned = inside && area >= FACE_MIN_AREA
    } catch {
      // detect() can transiently fail; leave previous state.
    }
  }

  function stopFaceDetection() {
    if (detectTimer) {
      clearInterval(detectTimer)
      detectTimer = null
    }
    detector = null
    faceAligned = false
  }

  function stopStream() {
    stopFaceDetection()
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

    const maxEdge = 800
    const scale = Math.min(1, maxEdge / Math.max(vw, vh))
    const cw = Math.round(vw * scale)
    const ch = Math.round(vh * scale)

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(videoEl, 0, 0, cw, ch)
    capturedDataUrl = canvas.toDataURL('image/jpeg', 0.7)
    stopFaceDetection()
    stage = 'captured'
  }

  function retake() {
    capturedDataUrl = null
    stage = 'streaming'
    startFaceDetection()
  }

  function confirm() {
    if (!capturedDataUrl) return
    stopStream()
    onComplete(capturedDataUrl)
  }

  function cancelToIntro() {
    stopStream()
    capturedDataUrl = null
    stage = 'intro'
  }

  onDestroy(() => stopStream())

  const isFullScreen = $derived(stage === 'requesting' || stage === 'streaming' || stage === 'captured')
</script>

{#if !isFullScreen}
  <!-- Intro card: shown before camera opens. Tips live here so user reads them
       once, before being immersed in the camera UI. -->
  <div class="card">
    <div class="logo-bar">
      <Logo height={24} />
      <span class="title-pill">Foto Selfie</span>
    </div>

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

      <ul class="tips">
        <li><span class="check">✓</span> Wajah terlihat jelas dan terang</li>
        <li><span class="check">✓</span> Lepas masker dan kacamata gelap</li>
        <li><span class="check">✓</span> Hindari cahaya dari belakang</li>
      </ul>

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
  </div>
{:else}
  <!-- Full-screen camera. Escapes any parent layout via `position: fixed`. -->
  <div class="fullscreen">
    <!-- A 9:16 inner column keeps the oval correctly proportioned even on
         landscape desktop viewports — black bars frame the camera column. -->
    <div class="cam-column">
      {#if stage === 'captured' && capturedDataUrl}
        <img class="cam-media" src={capturedDataUrl} alt="Selfie hasil" />
      {:else}
        <video bind:this={videoEl} class="cam-media" autoplay playsinline muted></video>
      {/if}

      <svg class="overlay" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <defs>
          <mask id="selfie-oval-mask-fs">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <ellipse cx="50%" cy="44%" rx="34%" ry="28%" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#selfie-oval-mask-fs)" />
        <ellipse
          cx="50%" cy="44%" rx="34%" ry="28%"
          fill="none"
          stroke={faceAligned ? '#22c55e' : 'white'}
          stroke-width={faceAligned ? 3 : 2}
          stroke-opacity="0.95"
        />
      </svg>

      <!-- Top bar (overlaid): close button + status pill -->
      <div class="top-bar">
        <button class="icon-btn" aria-label="Tutup kamera" onclick={cancelToIntro}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        </button>
        {#if stage === 'streaming'}
          <span class="status-pill" class:aligned={faceAligned}>
            {#if faceAligned}
              ✓ Wajah terdeteksi
            {:else}
              Posisikan wajah dalam bingkai
            {/if}
          </span>
        {:else if stage === 'captured'}
          <span class="status-pill">Pratinjau foto</span>
        {/if}
        <span class="icon-btn-spacer" aria-hidden="true"></span>
      </div>

      {#if stage === 'requesting'}
        <div class="loading">
          <span class="spinner-lg" aria-hidden="true"></span>
          <span>Mengaktifkan kamera…</span>
        </div>
      {/if}

      <!-- Bottom action bar (overlaid). Anchored to the bottom of the camera
           column so the shutter is always thumb-reachable. -->
      <div class="bottom-bar">
        {#if stage === 'streaming'}
          <button class="shutter" onclick={takePhoto} aria-label="Ambil foto">
            <span class="shutter-inner"></span>
          </button>
        {:else if stage === 'captured'}
          <div class="confirm-row">
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
      </div>
    </div>
  </div>
{/if}

<style>
  /* ─── Intro card ───────────────────────────────────────────────────────── */
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

  .tips {
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
    background: var(--tertiary-10, #f7f7f4);
    border-radius: var(--radius-lg);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
  }

  .tips li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13.5px;
    color: var(--tertiary-90, #2a2a25);
    font-weight: 500;
  }

  .check {
    color: #16a34a;
    font-weight: 800;
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
    margin-top: 4px;
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

  /* ─── Full-screen camera ───────────────────────────────────────────────── */
  .fullscreen {
    position: fixed;
    inset: 0;
    background: #000;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Use dynamic viewport height where supported (iOS Safari hides URL bar). */
    height: 100vh;
    height: 100dvh;
  }

  .cam-column {
    position: relative;
    height: 100%;
    /* Portrait 9:16 column so the oval stays correctly proportioned at any
       viewport aspect ratio; on landscape desktops, black bars frame it. */
    aspect-ratio: 9 / 16;
    max-width: 100vw;
    background: #000;
    overflow: hidden;
  }

  /* On portrait / mobile, fill the width fully (don't apply aspect). */
  @media (max-aspect-ratio: 9/16) {
    .cam-column {
      width: 100%;
      aspect-ratio: auto;
    }
  }

  .cam-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    /* Mirror live preview for "real mirror" feel. The captured frame is drawn
       from the un-mirrored video stream so saved images are correctly oriented. */
    transform: scaleX(-1);
  }

  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .top-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 12px 12px 16px;
    padding-top: max(12px, env(safe-area-inset-top));
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0));
    pointer-events: none; /* let underlying elements receive events except for buttons */
  }

  .icon-btn,
  .icon-btn-spacer {
    pointer-events: auto;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .icon-btn {
    border-radius: 50%;
    background: rgba(0,0,0,0.5);
    border: none;
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s;
  }
  .icon-btn:hover { background: rgba(0,0,0,0.7); }
  .icon-btn:active { transform: scale(0.94); }

  .status-pill {
    pointer-events: auto;
    background: rgba(0,0,0,0.55);
    color: white;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 999px;
    backdrop-filter: blur(4px);
    transition: background 0.2s;
    text-align: center;
    max-width: 70%;
  }

  .status-pill.aligned {
    background: rgba(34, 197, 94, 0.85);
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
    background: rgba(0, 0, 0, 0.55);
  }

  .spinner-lg {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .bottom-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 16px 20px 20px;
    padding-bottom: max(20px, calc(env(safe-area-inset-bottom) + 12px));
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0));
  }

  .shutter {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: white;
    border: 4px solid rgba(255,255,255,0.6);
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 4px rgba(0,0,0,0.25);
  }

  .shutter:active { transform: scale(0.94); }

  .shutter-inner {
    display: block;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: white;
    transition: background 0.2s;
  }

  .shutter:hover .shutter-inner { background: var(--primary-50, #f7bb00); }

  .confirm-row {
    width: 100%;
    max-width: 480px;
    display: flex;
    gap: 12px;
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
    background: var(--primary-50, #f7bb00);
    color: #221500;
  }
  .btn-primary:hover:not(:disabled) { background: #e8ae00; }
  .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }

  .btn-secondary {
    background: rgba(255,255,255,0.15);
    color: white;
    border: 1px solid rgba(255,255,255,0.4);
    backdrop-filter: blur(4px);
  }
  .btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
  .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

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
