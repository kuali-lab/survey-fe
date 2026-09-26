<script lang="ts">
  /**
   * Matrix question input. Never scrolls horizontally:
   *
   *  - Grid: the classic table, used only when it really fits the container.
   *    Column headers wrap, so a 7-point Likert still fits a 680px stage.
   *  - Compact: when the table would overflow (phones, landscape phones, wide
   *    scales), each row becomes an accordion item. One row is open at a time;
   *    picking an answer collapses it into a one-line summary and opens the
   *    next unanswered row. Short scales (1–10) render as a chip grid instead
   *    of ten stacked buttons.
   *
   * The switch is decided by measuring the table against the container, not by
   * a viewport breakpoint — the stage is capped at 720px, so a wide matrix
   * overflows on desktop too.
   */
  import { tick } from 'svelte'
  import { slide } from 'svelte/transition'
  import { Check, ChevronDown } from 'lucide-svelte'
  import type { MatrixRow, MatrixCol } from '$lib/types.js'
  import {
    type MatrixAnswer,
    answeredRowCount, nextUnansweredRow, isChipScale, chipColumns as chipColumnsOf,
  } from '$lib/matrixCompact.js'
  import { useI18n } from '$lib/i18n/context.js'

  let {
    rows,
    cols,
    value,
    onSelect,
  }: {
    rows: MatrixRow[]
    cols: MatrixCol[]
    // Record<rowLabel, colLabel>
    value: MatrixAnswer
    onSelect: (rowLabel: string, colLabel: string) => void
  } = $props()

  // 🔴 `value` dan `onSelect` tetap berbahasa UTAMA (Record<rowLabel, colLabel>):
  // itulah yang disimpan, divalidasi runner, dan dikirim. `i18n.label` hanya
  // dipakai di titik TAMPILAN.
  const i18n = useI18n()
  /** The stored answer (a primary-language column label) → its display text. */
  function answerText(colLabel: string): string {
    const col = cols.find((c) => c.label === colLabel)
    return col ? i18n.label(col) : colLabel
  }

  // ── Layout: grid when it fits, compact otherwise ───────────────────────────
  let wrapWidth = $state(0)
  let tableEl: HTMLTableElement | undefined = $state()
  // Width the table needs, recorded the moment it overflows. Compact mode
  // holds until the container grows past it (rotation, resize).
  let neededWidth = $state(0)
  let fontsReady = $state(0)

  const compact = $derived(wrapWidth === 0 || neededWidth > wrapWidth)

  $effect(() => {
    // Rows/cols changed → the old measurement is stale.
    void rows
    void cols
    neededWidth = 0
  })

  $effect(() => {
    void fontsReady
    if (!tableEl || wrapWidth === 0) return
    // width:100% + auto layout: the table only exceeds the wrapper when its
    // min-content width (longest header words + row label) doesn't fit.
    const need = tableEl.offsetWidth
    if (need > wrapWidth + 1) neededWidth = need
  })

  $effect(() => {
    // Web fonts land after first paint and change header widths.
    document.fonts?.ready.then(() => fontsReady++)
  })

  const chipScale = $derived(isChipScale(cols))
  const chipColumns = $derived(chipColumnsOf(cols))

  // ── Compact: accordion state ───────────────────────────────────────────────
  const answeredCount = $derived(answeredRowCount(rows, value))

  // Opened once, on mount: resuming a partly-filled matrix (back-navigation)
  // lands on the first gap. After that the open row is the respondent's to
  // move — a re-render must never yank it out from under them.
  let openRow = $state<string | null>(null)
  let initialised = false
  $effect(() => {
    if (initialised || rows.length === 0) return
    initialised = true
    openRow = nextUnansweredRow(rows, value)
  })

  let advanceTimer: ReturnType<typeof setTimeout> | null = null
  let listEl: HTMLDivElement | undefined = $state()

  function toggleRow(label: string) {
    if (advanceTimer) clearTimeout(advanceTimer)
    openRow = openRow === label ? null : label
  }

  function pick(row: MatrixRow, index: number, col: MatrixCol) {
    onSelect(row.label, col.label)
    if (!compact) return
    if (advanceTimer) clearTimeout(advanceTimer)
    // Brief beat so the respondent sees their pick land before it collapses.
    advanceTimer = setTimeout(async () => {
      advanceTimer = null
      const next = nextUnansweredRow(rows, { ...value, [row.label]: col.label }, index)
      openRow = next
      if (!next) return
      await tick()
      // Wait out the slide so the target's final position is known.
      setTimeout(() => {
        const el = listEl?.querySelector<HTMLElement>(`[data-row="${CSS.escape(next)}"]`)
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
      }, 220)
    }, 260)
  }

  $effect(() => () => {
    if (advanceTimer) clearTimeout(advanceTimer)
  })
</script>

<div class="matrix" bind:clientWidth={wrapWidth}>
  {#if !compact}
    <table class="grid" bind:this={tableEl}>
      <thead>
        <tr>
          <th class="corner"></th>
          {#each cols as col (col.id)}
            <th class="col-head" scope="col" style="width: {66 / cols.length}%">{i18n.label(col)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (row.id)}
          <tr class="grid-row">
            <th class="row-head" scope="row">{i18n.label(row)}</th>
            {#each cols as col (col.id)}
              {@const selected = value[row.label] === col.label}
              <td class="cell">
                <button
                  class="cell-btn"
                  class:selected
                  type="button"
                  aria-label="{i18n.label(row)}: {i18n.label(col)}"
                  aria-pressed={selected}
                  onclick={() => pick(row, i, col)}
                >
                  <span class="radio"></span>
                </button>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <div class="progress" aria-live="polite">
      <span class="progress-text">{i18n.t('matrixProgress', { n: answeredCount, total: rows.length })}</span>
      <span class="progress-track" aria-hidden="true">
        <span class="progress-fill" style="width: {rows.length ? (answeredCount / rows.length) * 100 : 0}%"></span>
      </span>
    </div>

    <div class="list" bind:this={listEl}>
      {#each rows as row, i (row.id)}
        {@const answer = value[row.label]}
        {@const open = openRow === row.label}
        <div class="item" class:open class:answered={!!answer} data-row={row.label}>
          <button
            class="item-head"
            type="button"
            aria-expanded={open}
            onclick={() => toggleRow(row.label)}
          >
            <span class="status" aria-hidden="true">
              {#if answer}<Check size={14} strokeWidth={3} />{:else}{i + 1}{/if}
            </span>
            <span class="item-text">
              <span class="item-label">{i18n.label(row)}</span>
              {#if answer && !open}
                <span class="item-answer">{answerText(answer)}</span>
              {/if}
            </span>
            <span class="chevron" aria-hidden="true"><ChevronDown size={18} /></span>
          </button>

          {#if open}
            <div
              class="options"
              class:chips={chipScale}
              style={chipScale ? `--chip-cols: ${chipColumns}` : undefined}
              role="group"
              aria-label={i18n.label(row)}
              transition:slide={{ duration: 180 }}
            >
              {#each cols as col (col.id)}
                {@const selected = answer === col.label}
                <button
                  class={chipScale ? 'chip' : 'option'}
                  class:selected
                  type="button"
                  aria-pressed={selected}
                  onclick={() => pick(row, i, col)}
                >
                  {#if !chipScale}<span class="radio"></span>{/if}
                  <span class="option-text">{i18n.label(col)}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .matrix {
    width: 100%;
    min-width: 0;
  }

  /* ── Shared radio dot ── */
  .radio {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--surface-pressed);
    background: var(--canvas);
    flex-shrink: 0;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }

  /* ── Grid ── */
  .grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .corner,
  .col-head {
    border-bottom: 1px solid var(--hairline);
    background: var(--canvas);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .col-head {
    padding: 8px 4px;
    font-weight: 500;
    font-size: 13px;
    line-height: 1.3;
    color: var(--text-body);
    text-align: center;
    vertical-align: bottom;
    /* Wrap between words, never mid-word: the longest word sets the column's
       minimum width, which is what the fit measurement relies on. */
    white-space: normal;
    overflow-wrap: normal;
    min-width: 44px;
  }

  .grid-row:nth-child(even) {
    background: var(--canvas-soft);
  }

  .row-head {
    padding: 12px 12px 12px 4px;
    font-size: 14px;
    font-weight: 400;
    text-align: left;
    color: var(--text-primary);
    line-height: 1.4;
    min-width: 140px;
    width: 34%;
  }

  .cell {
    padding: 0;
    text-align: center;
    vertical-align: middle;
    /* height on a td acts as min-height; lets the button fill the cell. */
    height: 48px;
  }

  /* The whole cell is the tap target, not just the 22px dot. */
  .cell-btn {
    width: 100%;
    height: 100%;
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 0;
  }

  .cell-btn:hover .radio {
    border-color: var(--ink);
  }

  .cell-btn.selected .radio {
    border-color: var(--ink);
    background: var(--on-ink);
    box-shadow: inset 0 0 0 4px var(--ink);
  }

  .cell-btn:focus-visible,
  .item-head:focus-visible,
  .option:focus-visible,
  .chip:focus-visible {
    outline: 2px solid var(--text-primary);
    outline-offset: 2px;
  }

  /* ── Compact: progress ── */
  .progress {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .progress-text {
    font-size: 13px;
    color: var(--text-body);
    white-space: nowrap;
  }

  .progress-track {
    flex: 1;
    height: 4px;
    border-radius: 2px;
    background: var(--canvas-softer);
    overflow: hidden;
  }

  .progress-fill {
    display: block;
    height: 100%;
    background: var(--ink);
    border-radius: 2px;
    transition: width 0.25s ease;
  }

  /* ── Compact: accordion ── */
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .item {
    border: 1px solid var(--hairline);
    border-radius: var(--radius-option);
    background: var(--canvas);
    /* Keep the auto-scrolled row clear of the sticky header / bottom nav. */
    scroll-margin-top: 72px;
    scroll-margin-bottom: 104px;
    transition: border-color 0.15s, background 0.15s;
  }

  .item.open {
    border-color: var(--text-primary);
  }

  .item.answered:not(.open) {
    background: var(--canvas-soft);
    border-color: var(--canvas-soft);
  }

  .item-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    min-height: 52px;
    border: 0;
    background: transparent;
    border-radius: var(--radius-option);
    font-family: var(--font);
    text-align: left;
    color: var(--text-primary);
    cursor: pointer;
  }

  .status {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-body);
    background: var(--canvas-softer);
  }

  .item.answered .status {
    background: var(--ink);
    color: var(--on-ink);
  }

  .item-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .item-label {
    font-size: 15px;
    font-weight: 500;
    line-height: 1.35;
  }

  .item-answer {
    font-size: 14px;
    font-weight: 600;
    color: var(--primary-text-strong);
    line-height: 1.35;
  }

  .chevron {
    display: flex;
    color: var(--text-muted);
    transition: transform 0.18s ease;
  }

  .item.open .chevron {
    transform: rotate(180deg);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 12px 12px;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 46px;
    padding: 10px 14px;
    text-align: left;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    background: var(--canvas);
    font-family: var(--font);
    font-size: 15px;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .option:hover,
  .chip:hover {
    border-color: var(--ink);
  }

  .option.selected,
  .chip.selected {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--on-ink);
  }

  .option.selected .radio {
    border-color: var(--on-ink);
    background: var(--on-ink);
    box-shadow: inset 0 0 0 4px var(--ink);
  }

  .option-text {
    flex: 1;
    min-width: 0;
  }

  /* Short scales: 1–10 becomes two rows of five instead of ten buttons. */
  .options.chips {
    display: grid;
    grid-template-columns: repeat(var(--chip-cols, 5), minmax(0, 1fr));
    gap: 6px;
  }

  .chip {
    min-height: 46px;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    background: var(--canvas);
    font-family: var(--font);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    text-align: center;
    transition: border-color 0.15s, background 0.15s;
  }
</style>
