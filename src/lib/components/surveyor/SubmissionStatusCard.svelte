<script lang="ts">
  import type { OutboxItem } from '$lib/outbox.js'
  import { ANSWER_VALIDATION_ERROR, BAD_REQUEST_ERROR } from '$lib/submitError.js'

  type Props = {
    item: OutboxItem | null
    onRetry?: (() => void) | null
    onContinue?: (() => void) | null
  }
  let { item, onRetry = null, onContinue = null }: Props = $props()

  function shortId(submissionId: string): string {
    return submissionId.slice(0, 8)
  }

  function fmtTime(ms: number): string {
    const d = new Date(ms)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  function fmtGapSeconds(fromMs: number, toMs: number): string {
    const s = Math.max(0, Math.round((toMs - fromMs) / 1000))
    if (s < 60) return `${s} detik`
    const m = Math.floor(s / 60)
    const ss = s % 60
    return `${m} menit ${ss} detik`
  }

  function humanError(code: string | null): string {
    if (!code) return 'Belum bisa kirim. Akan dicoba lagi otomatis.'
    if (code === 'unauthorized') return 'Sesi petugas berakhir. Silakan masuk ulang.'
    if (code === 'survey_closed') return 'Survei sudah ditutup.'
    if (code === 'submit_error') return 'Server menolak kiriman. Akan dicoba lagi.'
    // Terminal rejections: the payload is already frozen in the outbox, so
    // promising another automatic attempt would be a lie.
    if (code === ANSWER_VALIDATION_ERROR) return 'Jawaban ditolak server karena tidak lolos pemeriksaan. Kiriman ini tidak bisa dikirim ulang apa adanya — laporkan ke admin.'
    if (code === BAD_REQUEST_ERROR) return 'Data kiriman tidak dapat dibaca server. Kiriman ini tidak bisa dikirim ulang apa adanya — laporkan ke admin.'
    return 'Belum bisa kirim. Akan dicoba lagi otomatis.'
  }
</script>

{#if !item}
  <div class="card unknown">
    <div class="icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
    </div>
    <div class="body">
      <h2>Kiriman tidak ditemukan</h2>
      <p>Data mungkin sudah dibersihkan dari perangkat. Hubungi admin jika perlu konfirmasi.</p>
    </div>
  </div>
{:else if item.status === 'sent'}
  <div class="card sent">
    <div class="icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 12 10 17 19 7"/></svg>
    </div>
    <div class="body">
      <h2>Terkirim ke server</h2>
      <p class="meta">
        {fmtTime(item.sentAt ?? item.enqueuedAt)}
        {#if item.sentAt && item.enqueuedAt && item.sentAt - item.enqueuedAt > 1000}
          · {fmtGapSeconds(item.enqueuedAt, item.sentAt)} setelah disimpan
        {/if}
      </p>
      <p class="id">ID: {shortId(item.submissionId)}</p>
      {#if onContinue}
        <button class="btn primary" type="button" onclick={onContinue}>Mulai responden berikutnya</button>
      {/if}
    </div>
  </div>
{:else if item.status === 'sending'}
  <div class="card sending">
    <div class="icon">
      <span class="spinner" aria-hidden="true"></span>
    </div>
    <div class="body">
      <h2>Mengirim ke server…</h2>
      <p class="meta">
        Percobaan ke-{item.attempts}
        {#if item.lastAttemptAt}· dimulai {fmtTime(item.lastAttemptAt)}{/if}
      </p>
      <p class="id">ID: {shortId(item.submissionId)}</p>
    </div>
  </div>
{:else if item.status === 'permanent_fail'}
  <div class="card fail">
    <div class="icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>
    </div>
    <div class="body">
      <h2>Tidak bisa dikirim</h2>
      <p class="reason">{humanError(item.lastError)}</p>
      <p class="meta">Data masih tersimpan di perangkat — tidak akan hilang.</p>
      <p class="id">ID kiriman: {shortId(item.submissionId)}</p>
      {#if onRetry}
        <button class="btn primary" type="button" onclick={onRetry}>Coba kirim ulang</button>
      {/if}
    </div>
  </div>
{:else}
  <!-- pending -->
  <div class="card pending">
    <div class="icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
    </div>
    <div class="body">
      <h2>Tersimpan di perangkat</h2>
      <p class="meta">Jawaban aman — akan otomatis terkirim begitu jaringan kembali.</p>
      <p class="id">
        ID: {shortId(item.submissionId)} · disimpan {fmtTime(item.enqueuedAt)}
        {#if item.attempts > 0}
          · gagal {item.attempts}× ({humanError(item.lastError)})
        {/if}
      </p>
      {#if onContinue}
        <button class="btn secondary" type="button" onclick={onContinue}>Lanjut responden berikutnya</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .card {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 20px;
    border-radius: var(--radius-card);
    border: 1px solid var(--canvas-soft);
    background: var(--canvas);
  }
  .card .icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--canvas-soft);
    color: var(--tertiary-100);
  }
  .card .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .card h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    line-height: 1.25;
    color: var(--text-primary);
  }
  .card p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }
  .card .meta { color: var(--text-body); }
  .card .id {
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 12px;
    color: var(--text-muted);
  }
  .card .reason {
    color: var(--text-primary);
    font-weight: 500;
  }

  .pending .icon { background: var(--warning-tint); color: var(--warning-strong); }
  .sending .icon { background: var(--info-tint); color: var(--info-strong); }
  .sent {
    border-color: var(--success-border);
    background: var(--success-bg);
  }
  .sent .icon { background: var(--success); color: var(--on-ink); }
  .sent h2 { color: #15803d; }

  .fail {
    border-color: var(--error-border);
    background: var(--error-bg);
  }
  .fail .icon { background: var(--error); color: var(--on-ink); }
  .fail h2 { color: var(--error); }

  .unknown {
    background: var(--canvas-soft);
    border-color: var(--canvas-soft);
  }

  .spinner {
    width: 22px;
    height: 22px;
    border: 2.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: status-spin 0.8s linear infinite;
  }
  @keyframes status-spin {
    to { transform: rotate(360deg); }
  }

  .btn {
    margin-top: 4px;
    align-self: flex-start;
    min-height: 44px;
    padding: 0 20px;
    border-radius: var(--radius-pill);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .btn.primary {
    background: var(--ink);
    color: var(--on-ink);
  }
  .btn.primary:hover { background: var(--ink-elevated); }
  .btn.secondary {
    background: var(--canvas);
    color: var(--tertiary-100);
    border-color: var(--tertiary-100);
  }
  .btn.secondary:hover { background: var(--surface); }
</style>
