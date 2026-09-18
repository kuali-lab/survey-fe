<!--
  The FIRST step of a two-language survey: the respondent picks their language, and
  only then does the welcome page appear in it. A single-language survey never
  reaches this screen.

  One tap = choose and continue; there is no separate "Continue" button. The choice
  is not binding: the `ID | EN` corner pill stays available afterwards, and answers
  are stored as primary-language labels (see `$lib/i18n/content.ts`), so switching
  later loses nothing.

  The screen itself is written in EVERY offered language at once, and each button
  carries the survey title in its own language — so the respondent confirms both
  "this is my language" and "this is the right survey" at a glance.
-->
<script lang="ts">
  import { isCustomLogo, resolveLogoUrl } from '$lib/branding.js'
  import { resolveMediaUrl } from '$lib/mediaUrl.js'
  import type { LanguageChoice } from '$lib/i18n/content.js'
  import { t } from '$lib/i18n/messages.js'

  let {
    choices,
    titles = {},
    suggested = null,
    onSelect,
    logoUrl = null,
  }: {
    choices: LanguageChoice[]
    /** The survey title (plain text) per language code. */
    titles?: Record<string, string>
    /** The language matching the browser — highlighted only, NEVER pre-selected. */
    suggested?: string | null
    onSelect: (code: string) => void
    logoUrl?: string | null
  } = $props()

  const logoMedia = $derived(resolveMediaUrl(logoUrl))
  const logoSrc = $derived(resolveLogoUrl(logoMedia))
  const logoAlt = $derived(isCustomLogo(logoMedia) ? 'Logo' : 'Logika Statistik')
  const headings = $derived([...new Set(choices.map((c) => t(c.code, 'chooseLanguage')))])
</script>

<div class="language-page" data-testid="language-page">
  <div class="logo-bar">
    <img src={logoSrc} alt={logoAlt} class="logo-img" />
  </div>

  <div class="globe" aria-hidden="true">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/>
      <path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18" stroke="currentColor" stroke-width="1.6"/>
    </svg>
  </div>

  <h1 class="heading">
    {#each headings as heading, i (heading)}
      <span class="heading-line" class:heading-alt={i > 0}>{heading}</span>
    {/each}
  </h1>

  <div class="choices">
    {#each choices as choice (choice.code)}
      <button
        type="button"
        class="choice"
        class:suggested={suggested === choice.code}
        lang={choice.code}
        data-testid="language-{choice.code}"
        onclick={() => onSelect(choice.code)}
      >
        <span class="choice-text">
          <span class="choice-name">{choice.name}</span>
          {#if titles[choice.code]}
            <span class="choice-title">{titles[choice.code]}</span>
          {/if}
        </span>
        <svg class="choice-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    {/each}
  </div>
</div>

<style>
  .language-page {
    max-width: 440px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  /* Matches WelcomePage, so the logo does not jump when moving between screens. */
  .logo-bar {
    position: fixed;
    top: 24px;
    left: 24px;
    display: flex;
    align-items: center;
    z-index: 10;
  }
  .logo-img {
    width: 140px;
    height: 36px;
    object-fit: contain;
    object-position: left center;
    display: block;
  }
  @media (max-width: 640px) {
    .logo-bar {
      position: static;
      align-self: flex-start;
      margin-bottom: 4px;
    }
    .logo-img {
      width: 104px;
      height: 26px;
    }
  }

  .globe {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--canvas-soft);
    color: var(--text-primary);
  }

  .heading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-align: center;
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .heading-line {
    font-size: 26px;
    line-height: 34px;
    color: var(--text-primary);
  }
  .heading-line.heading-alt {
    font-size: 18px;
    line-height: 26px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .choices {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .choice {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    font-family: var(--font);
    background: var(--canvas);
    color: var(--text-primary);
    border: 1.5px solid var(--hairline);
    border-radius: var(--radius-card);
    padding: 16px 18px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .choice:hover,
  .choice:focus-visible {
    border-color: var(--ink);
    background: var(--canvas-soft);
  }
  .choice.suggested {
    border-color: var(--ink);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ink) 18%, transparent);
  }

  .choice-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .choice-name {
    font-size: 18px;
    line-height: 26px;
    font-weight: 600;
  }
  .choice-title {
    font-size: 14px;
    line-height: 20px;
    color: var(--text-body);
  }
  .choice-arrow {
    flex-shrink: 0;
    color: var(--text-muted);
  }
  .choice:hover .choice-arrow,
  .choice.suggested .choice-arrow { color: var(--text-primary); }

  @media (prefers-reduced-motion: no-preference) {
    .choice:active { transform: scale(0.99); }
  }
</style>
