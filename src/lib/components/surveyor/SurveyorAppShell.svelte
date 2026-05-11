<script lang="ts">
  import { onMount } from 'svelte'
  import Logo from '$lib/components/Logo.svelte'
  import SurveyorStats from './SurveyorStats.svelte'
  import InterviewTimer from './InterviewTimer.svelte'
  import GpsStatusBadge from './GpsStatusBadge.svelte'
  import OutboxBadge from './OutboxBadge.svelte'
  import OutboxToast from './OutboxToast.svelte'
  import { goto } from '$app/navigation'
  import { clearSurveyorSession } from '$lib/surveyorAuth.js'
  import { startOutboxDrain } from '$lib/outboxDrain.js'

  // Idempotent — safe to call from every surveyor page; only the first
  // invocation wires the online listener and the poll interval.
  onMount(() => { startOutboxDrain() })

  type Props = {
    surveyTitle: string
    displayName: string
    slug: string
    todayCount: number
    totalCount: number
    /** When set, renders the elapsed-time timer next to the right cluster. */
    interviewStartedAt?: number | null
    /** When set, renders the GPS status badge. */
    gpsStatus?: 'idle' | 'pending' | 'ok' | 'error'
    /** Optional extra menu item: confirm-discard for the interview screen. */
    onDiscard?: (() => void) | null
  }
  let {
    surveyTitle,
    displayName,
    slug,
    todayCount,
    totalCount,
    interviewStartedAt = null,
    gpsStatus = 'idle',
    onDiscard = null,
  }: Props = $props()

  let menuOpen = $state(false)

  function toggleMenu() { menuOpen = !menuOpen }
  function closeMenu() { menuOpen = false }

  function handleLogout() {
    clearSurveyorSession()
    goto(`/surveyor/s/${slug}`, { replaceState: true })
  }

  function handleDiscard() {
    closeMenu()
    if (onDiscard) onDiscard()
  }

  function handleHelp() {
    closeMenu()
    // Future: link to docs / contact. For now: alert is good enough.
    if (typeof window !== 'undefined') {
      window.alert('Hubungi pemilik survei untuk bantuan kode atau pertanyaan teknis.')
    }
  }
</script>

<header class="shell">
  <div class="left">
    <Logo />
    <div class="meta">
      <div class="title" title={surveyTitle}>{surveyTitle}</div>
      <div class="sub">Petugas: <strong>{displayName}</strong></div>
    </div>
  </div>

  <div class="right">
    {#if interviewStartedAt}
      <InterviewTimer startedAt={interviewStartedAt} />
    {/if}
    {#if gpsStatus !== 'idle'}
      <GpsStatusBadge status={gpsStatus} />
    {/if}
    <OutboxBadge />
    <SurveyorStats {todayCount} {totalCount} variant="pill" />

    <div class="menu-wrap">
      <button class="menu-btn" type="button" onclick={toggleMenu} aria-label="Menu" aria-expanded={menuOpen}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {#if menuOpen}
        <div class="menu" role="menu">
          {#if onDiscard}
            <button class="menu-item danger" type="button" role="menuitem" onclick={handleDiscard}>Buang responden ini</button>
            <div class="menu-sep"></div>
          {/if}
          <button class="menu-item" type="button" role="menuitem" onclick={handleHelp}>Bantuan</button>
          <button class="menu-item" type="button" role="menuitem" onclick={handleLogout}>Keluar bertugas</button>
        </div>
      {/if}
    </div>
  </div>
</header>

{#if menuOpen}
  <button class="menu-scrim" aria-label="Tutup menu" onclick={closeMenu}></button>
{/if}

<OutboxToast />

<style>
  .shell {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: white;
    border-bottom: 1px solid var(--tertiary-30);
    box-shadow: inset 3px 0 0 var(--primary-50);
    padding: 8px 16px;
    min-height: 56px;
  }

  .left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }

  .meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }

  .title {
    font-size: 14px;
    font-weight: 700;
    color: var(--tertiary-100);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 32ch;
  }

  .sub {
    font-size: 11.5px;
    color: var(--tertiary-70);
  }

  .right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .menu-wrap {
    position: relative;
  }

  .menu-btn {
    background: transparent;
    border: 1px solid var(--tertiary-30);
    border-radius: var(--radius-md);
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--tertiary-70);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .menu-btn:hover {
    background: var(--tertiary-20);
    border-color: var(--tertiary-40);
  }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 200px;
    background: white;
    border: 1px solid var(--tertiary-30);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.10);
    padding: 6px;
    display: flex;
    flex-direction: column;
    z-index: 40;
  }

  .menu-item {
    text-align: left;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    font-family: var(--font);
    font-size: 13px;
    font-weight: 600;
    color: var(--tertiary-100);
    cursor: pointer;
  }

  .menu-item:hover {
    background: var(--tertiary-20);
  }

  .menu-item.danger {
    color: var(--error-50);
  }

  .menu-sep {
    height: 1px;
    background: var(--tertiary-30);
    margin: 4px 2px;
  }

  .menu-scrim {
    position: fixed;
    inset: 0;
    background: transparent;
    border: none;
    cursor: default;
    z-index: 29;
  }

  @media (max-width: 600px) {
    .shell {
      padding: 8px 12px;
      gap: 8px;
    }
    .title {
      max-width: 14ch;
      font-size: 13px;
    }
    .sub {
      display: none;
    }
    .right {
      gap: 6px;
    }
  }
</style>
