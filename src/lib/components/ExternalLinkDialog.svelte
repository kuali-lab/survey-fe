<script lang="ts">
  import { tick } from 'svelte'
  import { interceptRichLink } from '$lib/externalLink.js'
  import { t } from '$lib/i18n/messages.js'

  let dialog: HTMLDialogElement
  // Tidak dikosongkan saat ditutup supaya isi tetap ada selama animasi keluar.
  let url = $state<URL | null>(null)
  let label = $state<string | null>(null)
  let locale = $state('id')

  // Dipasang di akar layout, di luar provider i18n halaman survei: bahasa dibaca dari <html lang>.
  async function open(next: URL, nextLabel: string | null) {
    url = next
    label = nextLabel
    locale = document.documentElement.lang || 'id'
    // Isi dirender setelah state berubah; showModal sebelum itu membuat autofocus tak punya target.
    await tick()
    dialog.showModal()
  }

  function onLinkClick(event: MouseEvent) {
    interceptRichLink(event, open)
  }

  function visit() {
    if (url) window.open(url.href, '_blank', 'noopener,noreferrer')
    dialog.close()
  }

  // Host tebal, sisanya redup: pembeda utama saat memeriksa tujuan.
  const parts = $derived.by(() => {
    if (!url) return null
    const rest = url.pathname + url.search + url.hash
    const hostStart = url.href.length - rest.length - url.host.length
    return { before: url.href.slice(0, hostStart), host: url.host, rest }
  })
</script>

<svelte:document onclick={onLinkClick} onauxclick={onLinkClick} />

<!-- Klik pada latar (::backdrop) menjadikan <dialog> sebagai target. -->
<dialog
  bind:this={dialog}
  aria-labelledby="ext-link-title"
  data-testid="external-link-dialog"
  onclick={(e) => { if (e.target === dialog) dialog.close() }}
  onkeydown={(e) => e.stopPropagation()}
>
  {#if parts}
    <div class="box">
      <h2 id="ext-link-title" class="title">{t(locale, 'extLinkTitle')}</h2>
      <p class="body">{t(locale, 'extLinkBody')}</p>
      {#if label}
        <p class="label" data-testid="external-link-label"><span>{t(locale, 'extLinkLabel')}</span> {label}</p>
      {/if}
      <p class="url" data-testid="external-link-url"><span class="dim">{parts.before}</span><strong>{parts.host}</strong><span class="dim">{parts.rest}</span></p>
      <div class="actions">
        <!-- svelte-ignore a11y_autofocus -->
        <button class="btn-pill-secondary" type="button" autofocus onclick={() => dialog.close()}>
          {t(locale, 'extLinkCancel')}
        </button>
        <button class="btn-pill-primary" type="button" data-testid="external-link-visit" onclick={visit}>
          {t(locale, 'extLinkVisit')}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(440px, calc(100vw - 32px));
    max-width: none;
    /* Reset global menghapus margin:auto bawaan <dialog>, tanpa ini ia menempel di pojok. */
    margin: auto;
    padding: 0;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-card);
    background: var(--canvas);
    color: var(--text-primary);
    font-family: var(--font);
    opacity: 0;
    transform: translateY(8px) scale(0.98);
    transition:
      opacity 120ms ease-in,
      transform 120ms ease-in,
      overlay 120ms allow-discrete,
      display 120ms allow-discrete;
  }

  dialog[open] {
    opacity: 1;
    transform: none;
    transition-duration: 180ms;
    transition-timing-function: ease-out;
  }

  @starting-style {
    dialog[open] {
      opacity: 0;
      transform: translateY(8px) scale(0.98);
    }
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.45);
    opacity: 0;
    transition:
      opacity 120ms ease-in,
      overlay 120ms allow-discrete,
      display 120ms allow-discrete;
  }

  dialog[open]::backdrop {
    opacity: 1;
    transition-duration: 180ms;
  }

  @starting-style {
    dialog[open]::backdrop {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    dialog,
    dialog::backdrop {
      transition: none;
      transform: none;
    }
  }

  .box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px;
  }

  .title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .body {
    margin: 0;
    font-size: 15px;
    line-height: 1.55;
    color: var(--text-body);
  }

  .label {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--text-primary);
    overflow-wrap: anywhere;
  }

  .label span {
    color: var(--text-body);
  }

  /* Monospace hanya di sini: setiap karakter alamat harus bisa diperiksa. */
  .url {
    margin: 0;
    padding: 12px 14px;
    max-height: min(40dvh, 320px);
    overflow-y: auto;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-lg);
    background: var(--canvas-soft);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 14px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .url strong {
    font-weight: 700;
    color: var(--text-primary);
  }

  .dim {
    color: var(--text-body);
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .actions button {
    flex: 1;
    min-height: 48px;
    padding: 0 16px;
  }
</style>
