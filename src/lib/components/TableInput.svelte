<script lang="ts">
  /**
   * Input tipe Tabel. Lebar cukup → tabel semantik (baris judul kelompok K115);
   * sempit → satu baris satu accordion (K111), kolom ditumpuk, nol scroll
   * horizontal. Aturan isi/validasi ada di $lib/table.ts, komponen ini hanya
   * tata letak + baris yang sedang terbuka.
   */
  import { tick, untrack } from 'svelte'
  import { slide } from 'svelte/transition'
  import type { AnswerValue, Question, TableRow } from '$lib/types.js'
  import {
    ROW_HEAD_WEIGHT, activeRows, columnMinRem, columnWeight, filledCount, firstOpenRow, groupRows, isCompactTable, isRowComplete, setCell,
    toTableAnswer, validateTable,
  } from '$lib/table.js'
  import { questionErrorId, scalarRuleError } from '$lib/utils.js'
  import { useI18n } from '$lib/i18n/context.js'
  import TableCellInput from './TableCellInput.svelte'

  let {
    question,
    value,
    onChange,
    error = null,
  }: {
    question: Question
    value: AnswerValue
    onChange: (v: AnswerValue) => void
    /** Pesan galat runner untuk pertanyaan ini; dipakai menandai sel dan membuka barisnya. */
    error?: string | null
  } = $props()

  const i18n = useI18n()
  const answer = $derived(toTableAnswer(value))
  const rows = $derived(activeRows(question))
  const groups = $derived(groupRows(question))
  const columns = $derived(question.fields ?? [])
  const errorId = $derived(questionErrorId(question.id))
  // Lebar kolom grid proporsional terhadap isi: dropdown berlabel panjang dapat ruang lebih.
  const weights = $derived(columns.map(columnWeight))
  const totalWeight = $derived(weights.reduce((sum, w) => sum + w, ROW_HEAD_WEIGHT))
  const pct = (w: number) => `${(w / totalWeight) * 100}%`

  let width = $state(0)
  // Bukan state: hanya diingat untuk histeresis isCompactTable, render awal (lebar 0) accordion.
  let wasCompact = true
  const compact = $derived.by(() => (wasCompact = isCompactTable(width, columns, wasCompact)))

  // Penilai sel sama dengan runner, jadi sel yang ditandai = sel di pesan galat.
  const invalid = $derived(error ? validateTable(question, value, (c, v) => scalarRuleError(c, v, i18n.t)) : null)

  // Dibuka sekali saat tampil (baris pertama yang belum lengkap); sesudahnya milik responden.
  let openRow = $state<string | null>(untrack(() => firstOpenRow(question, value)))
  $effect(() => {
    if (invalid?.rowKey) openRow = invalid.rowKey
  })

  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  let listEl: HTMLDivElement | undefined = $state()

  const keyOf = (row: TableRow) => String(row.key)
  const cellLabel = (row: TableRow, col: Question) => `${i18n.label(row)} — ${i18n.plain(col, 'title')}`
  const isInvalid = (row: TableRow, col: Question) => invalid?.rowKey === keyOf(row) && invalid.columnId === col.id

  function update(row: TableRow, col: Question, v: AnswerValue) {
    onChange(setCell(value, keyOf(row), col.id, v))
  }

  async function openNext(row: TableRow) {
    const next = rows[rows.indexOf(row) + 1]
    openRow = next ? keyOf(next) : null
    if (!next) return
    await tick()
    listEl?.querySelector<HTMLElement>(`[data-row="${keyOf(next)}"] .fields :is(input, select)`)?.focus()
  }
</script>

{#snippet cell(row: TableRow, col: Question, hintId?: string)}
  <TableCellInput
    column={col}
    value={answer[keyOf(row)]?.[col.id]}
    label={cellLabel(row, col)}
    invalid={isInvalid(row, col)}
    describedBy={errorId}
    {hintId}
    wrapValue={!compact}
    onChange={(v) => update(row, col, v)}
  />
{/snippet}

<div class="table-q" class:grid-wrap={!compact} bind:clientWidth={width}>
  {#if !compact}
    <table class="grid">
      <caption class="sr-only">{i18n.plain(question, 'title')}</caption>
      <colgroup>
        <col style:width={pct(ROW_HEAD_WEIGHT)} />
        {#each weights as w, i (i)}<col style:width={pct(w)} />{/each}
      </colgroup>
      <thead>
        <tr>
          <td class="corner"></td>
          {#each columns as col (col.id)}
            <th class="col-head" scope="col">
              {i18n.plain(col, 'title')}{#if col.required}<span class="req" aria-hidden="true">*</span>{/if}
              {#if col.description}<span class="col-hint">{i18n.plain(col, 'description')}</span>{/if}
            </th>
          {/each}
        </tr>
      </thead>
      {#each groups as g, gi (gi)}
        <tbody>
          {#if g.group}
            <tr class="group-row"><th scope="rowgroup" colspan={columns.length + 1}>{g.group}</th></tr>
          {/if}
          {#each g.rows as row (row.key)}
            <tr class="grid-row">
              <th class="row-head" scope="row">{i18n.label(row)}</th>
              {#each columns as col (col.id)}
                <td class="cell" style:--cell-min="{columnMinRem(col)}rem">{@render cell(row, col)}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      {/each}
    </table>
  {:else}
    <div class="list" bind:this={listEl}>
      {#each groups as g, gi (gi)}
        {#if g.group}<p class="group-head">{g.group}</p>{/if}
        {#each g.rows as row (row.key)}
          {@const key = keyOf(row)}
          {@const open = openRow === key}
          {@const done = isRowComplete(question, value, key)}
          {@const filled = filledCount(question, value, key)}
          {@const panelId = `table-${question.id}-row-${key}`}
          <div class="item" class:open class:answered={done} data-row={key}>
            <button
              class="item-head"
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onclick={() => (openRow = open ? null : key)}
            >
              <span class="status" aria-hidden="true">
                {#if done}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{:else}{rows.indexOf(row) + 1}{/if}
              </span>
              <span class="item-label">{i18n.label(row)}</span>
              <span class="badge">
                <span aria-hidden="true">{filled}/{columns.length}</span>
                <span class="sr-only">{i18n.t('matrixProgress', { n: filled, total: columns.length })}</span>
              </span>
              <span class="chevron" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </span>
            </button>
            {#if open}
              <div id={panelId} class="fields" role="group" aria-label={i18n.label(row)} transition:slide={{ duration: reduceMotion ? 0 : 180 }}>
                {#each columns as col (col.id)}
                  {@const hintId = col.description ? `${panelId}-hint-${col.id}` : undefined}
                  <div class="field">
                    <span class="field-label" aria-hidden="true">
                      {i18n.plain(col, 'title')}{#if col.required}<span class="req">*</span>{/if}
                    </span>
                    {#if hintId}<span class="col-hint" id={hintId}>{i18n.plain(col, 'description')}</span>{/if}
                    {@render cell(row, col, hintId)}
                  </div>
                {/each}
                {#if rows.indexOf(row) < rows.length - 1}
                  <button class="next-row" type="button" onclick={() => openNext(row)}>{i18n.t('tableNextRow')} →</button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .table-q { width: 100%; min-width: 0; }
  /* Banyak kolom pilihan di lebar tanggung bisa melebihi kartu; gulir di tabel, bukan halaman. */
  .table-q.grid-wrap { overflow-x: auto; }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  .req { color: var(--error); margin-left: 2px; }

  .col-hint {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    font-weight: 400;
    color: var(--text-muted);
  }

  /* ── Grid: pola .grid MatrixInput ── */
  .grid { width: 100%; border-collapse: collapse; font-size: 14px; }

  .corner,
  .col-head {
    border-bottom: 1px solid var(--hairline);
    background: var(--canvas);
  }

  .col-head {
    padding: 8px 4px;
    font-weight: 500;
    font-size: 13px;
    line-height: 1.3;
    color: var(--text-body);
    text-align: left;
    vertical-align: bottom;
    overflow-wrap: anywhere;
  }

  .group-row th {
    padding: 12px 4px 6px;
    font-size: 13px;
    font-weight: 600;
    text-align: left;
    color: var(--text-primary);
    border-bottom: 1px solid var(--hairline);
  }

  .grid-row:nth-child(even) { background: var(--canvas-soft); }

  .row-head {
    padding: 8px 8px 8px 4px;
    font-weight: 400;
    text-align: left;
    color: var(--text-primary);
    line-height: 1.4;
  }

  /* --cell-min: lantai dari columnMinRem; padding 3px dihitung requiredGridWidth (ubah keduanya bersamaan).
     Di pita histeresis tabel bisa melebar ≤16px dan digulir di .grid-wrap. */
  .cell { padding: 6px 3px; vertical-align: top; --cell-pad: 6px; }

  /* ── Accordion: pola .item MatrixInput ── */
  .list { display: flex; flex-direction: column; gap: 8px; }

  .group-head {
    margin: 8px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-body);
  }

  .item {
    border: 1px solid var(--hairline);
    border-radius: var(--radius-option);
    background: var(--canvas);
    scroll-margin-top: 72px;
    scroll-margin-bottom: 104px;
    transition: border-color 0.15s, background 0.15s;
  }

  .item.open { border-color: var(--text-primary); }
  .item.answered:not(.open) { background: var(--canvas-soft); border-color: var(--canvas-soft); }

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

  .item-head:focus-visible,
  .next-row:focus-visible {
    outline: 2px solid var(--text-primary);
    outline-offset: 2px;
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

  .item.answered .status { background: var(--ink); color: var(--on-ink); }

  .item-label { flex: 1; min-width: 0; font-size: 15px; font-weight: 500; line-height: 1.35; overflow-wrap: anywhere; }

  .badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-body);
    font-variant-numeric: tabular-nums;
  }

  .chevron { display: flex; color: var(--text-muted); transition: transform 0.18s ease; }
  .item.open .chevron { transform: rotate(180deg); }

  .fields { display: flex; flex-direction: column; gap: 12px; padding: 2px 14px 14px; }
  .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .field-label { font-size: 13px; font-weight: 600; color: var(--text-body); }

  .next-row {
    align-self: flex-end;
    border: 1px solid var(--hairline);
    border-radius: var(--radius-md);
    background: var(--canvas);
    padding: 10px 14px;
    min-height: 44px;
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
  }

  .next-row:hover { border-color: var(--ink); }

  @media (prefers-reduced-motion: reduce) {
    .item, .chevron { transition: none; }
  }
</style>
