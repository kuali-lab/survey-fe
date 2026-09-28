<!--
  The `ID | EN` corner pill, shown AFTER the respondent picks a language in the
  first step (`LanguageSelectPage`): on the welcome page and while answering.

  It is a safety net for anyone who picked wrong. Safe to use at any point, because
  answers are stored as primary-language labels (see `$lib/i18n/content.ts`) —
  switching language mid-survey loses nothing.

  Each button carries `lang` and the language's own name as its `aria-label`, so a
  screen reader pronounces it correctly.
-->
<script lang="ts">
  import type { LanguageChoice } from '$lib/i18n/content.js'
  import { t } from '$lib/i18n/messages.js'

  let {
    choices,
    locale,
    onChange,
  }: {
    choices: LanguageChoice[]
    locale: string
    onChange: (code: string) => void
  } = $props()

  const caption = $derived(
    [...new Set(choices.map((c) => t(c.code, 'chooseLanguage')))].join(' · '),
  )
</script>

{#if choices.length > 1}
  <div class="picker" role="radiogroup" aria-label={caption} data-testid="language-picker">
    {#each choices as choice (choice.code)}
      <button
        type="button"
        role="radio"
        class="option"
        class:selected={locale === choice.code}
        aria-checked={locale === choice.code}
        aria-label={choice.name}
        lang={choice.code}
        data-testid="language-switch-{choice.code}"
        onclick={() => onChange(choice.code)}
      >
        {choice.code.toUpperCase()}
      </button>
    {/each}
  </div>
{/if}

<style>
  /* Sits BELOW the progress bar (which spans the full width at y≈18px) so it never
     covers its right-hand end. */
  .picker {
    position: fixed;
    top: 32px;
    right: 16px;
    z-index: 20;
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    background: var(--canvas-soft);
    border: 1px solid var(--hairline);
    border-radius: var(--radius-pill);
  }

  .option {
    font-family: var(--font);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    letter-spacing: 0.02em;
    color: var(--text-body);
    background: transparent;
    border: none;
    border-radius: var(--radius-pill);
    padding: 5px 10px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .option:hover { color: var(--text-primary); }
  .option.selected {
    background: var(--canvas);
    color: var(--text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
</style>
