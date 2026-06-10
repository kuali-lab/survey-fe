<script lang="ts">
  import type { AnswerValue } from '$lib/types.js'
  import { fetchRegions, type RegionOption } from '$lib/api.js'
  import { untrack } from 'svelte'

  let {
    value,
    regionDepth = 2,
    onChange,
    onBlur,
  }: {
    value: AnswerValue
    regionDepth?: number
    onChange: (v: AnswerValue) => void
    onBlur?: () => void
  } = $props()

  // Indonesian level labels, indexed by level-1 (0=Provinsi … 3=Desa).
  const LEVEL_LABELS = ['Provinsi', 'Kabupaten/Kota', 'Kecamatan', 'Desa']

  // Clamp the configured depth to the valid 1..4 range; undefined → 2 (handled
  // by the prop default above).
  const depth = $derived(Math.min(4, Math.max(1, regionDepth || 2)))

  // The answer value is the DEEPEST selected BPS code (a dot-prefix string).
  const currentCode = $derived(typeof value === 'string' ? value : '')

  // Per-level UI state. `selected[i]` is the chosen RegionOption for level i
  // (0-based); null until picked. `lists[i]` is the currently displayed option
  // list for that level's dropdown (re-fetched on search). `loading[i]` /
  // `open[i]` / `query[i]` drive each level's typeahead independently.
  let selected = $state<(RegionOption | null)[]>(Array(4).fill(null))
  let lists = $state<RegionOption[][]>([[], [], [], []])
  let loading = $state<boolean[]>([false, false, false, false])
  let open = $state<boolean[]>([false, false, false, false])
  let query = $state<string[]>(['', '', '', ''])

  // Parent code for a given level: level 0 has no parent (top-level provinces);
  // each deeper level's parent is the code selected one level up.
  function parentCodeFor(level: number): string | undefined {
    if (level === 0) return undefined
    return selected[level - 1]?.code
  }

  // Debounced search per level. Typing filters via the `q` param so we never
  // render thousands of rows; an empty query loads the first page of children.
  let searchTimers: (ReturnType<typeof setTimeout> | null)[] = [null, null, null, null]

  async function loadLevel(level: number, q = '') {
    // Deeper levels can only load once their parent is chosen.
    if (level > 0 && !selected[level - 1]) return
    loading[level] = true
    const rows = await fetchRegions(parentCodeFor(level), q || undefined)
    // Guard against a stale response landing after the parent changed.
    loading[level] = false
    lists[level] = rows
  }

  function onSearchInput(level: number, q: string) {
    query[level] = q
    if (searchTimers[level]) clearTimeout(searchTimers[level]!)
    searchTimers[level] = setTimeout(() => {
      searchTimers[level] = null
      void loadLevel(level, q)
    }, 220)
  }

  function openLevel(level: number) {
    if (level > 0 && !selected[level - 1]) return
    open[level] = true
    // Load the initial children page lazily the first time the dropdown opens
    // (or whenever it's empty), respecting any text already typed.
    if (lists[level].length === 0 && !loading[level]) {
      void loadLevel(level, query[level])
    }
  }

  function closeLevel(level: number) {
    open[level] = false
  }

  function pickRegion(level: number, opt: RegionOption) {
    selected[level] = opt
    query[level] = ''
    open[level] = false

    // Changing a parent invalidates every deeper level: clear their selection,
    // cached lists, and queries so they re-fetch fresh children on next open.
    for (let i = level + 1; i < 4; i++) {
      selected[i] = null
      lists[i] = []
      query[i] = ''
      open[i] = false
    }

    emit()
  }

  // Emit the deepest currently-selected code (string). If nothing is selected
  // at all, emit null so required-validation treats it as unanswered (AnswerValue
  // has no `undefined` member; null is the canonical "empty" the runner checks).
  function emit() {
    let deepest = ''
    for (let i = 0; i < depth; i++) {
      if (selected[i]) deepest = selected[i]!.code
    }
    onChange(deepest || null)
  }

  // ── Best-effort value restore on mount ─────────────────────────────────────
  // Given an existing leaf code (e.g. "32.73.01"), derive each ancestor code by
  // dot-prefix ("32", "32.73", "32.73.01"), fetch each level's list, and
  // preselect the matching row. Done sequentially because each level's fetch
  // needs its parent code. Failures are swallowed — at worst the respondent
  // re-picks; we never crash.
  function ancestorCodes(code: string): string[] {
    const parts = code.split('.')
    return parts.map((_, i) => parts.slice(0, i + 1).join('.'))
  }

  async function restore(code: string) {
    const codes = ancestorCodes(code).slice(0, depth)
    for (let level = 0; level < codes.length; level++) {
      const rows = await fetchRegions(parentCodeFor(level))
      lists[level] = rows
      const match = rows.find((r) => r.code === codes[level])
      if (!match) {
        // Couldn't resolve this ancestor (e.g. search-only API). Stop here —
        // shallower levels still show what we resolved; don't crash.
        break
      }
      selected[level] = match
    }
  }

  // Run restore once, only when an initial code is present and nothing is
  // selected yet. untrack() keeps this out of the reactive graph so later
  // onChange-driven value updates don't re-trigger a restore.
  $effect(() => {
    const initial = untrack(() => currentCode)
    if (initial && untrack(() => selected.every((s) => s === null))) {
      void restore(initial)
    }
  })

  // Close any open dropdown when clicking outside the component.
  function onWindowClick(e: MouseEvent) {
    if (!rootEl) return
    if (!rootEl.contains(e.target as Node)) {
      open = [false, false, false, false]
    }
  }
  let rootEl: HTMLDivElement | undefined = $state()
</script>

<svelte:window onclick={onWindowClick} />

<div class="region-input" bind:this={rootEl}>
  {#each Array(depth) as _, level}
    {@const disabled = level > 0 && !selected[level - 1]}
    <div class="region-level">
      <span class="region-level-label">{LEVEL_LABELS[level]}</span>
      <div class="region-combo">
        <button
          type="button"
          class="region-trigger {open[level] ? 'open' : ''} {disabled ? 'disabled' : ''}"
          {disabled}
          aria-haspopup="listbox"
          aria-expanded={open[level]}
          onclick={() => (open[level] ? closeLevel(level) : openLevel(level))}
          onblur={() => onBlur?.()}
        >
          <span class="region-trigger-text {selected[level] ? '' : 'placeholder'}">
            {selected[level]?.name ?? `Pilih ${LEVEL_LABELS[level]}`}
          </span>
          <svg class="region-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        {#if open[level]}
          <div class="region-panel" role="listbox">
            <input
              class="region-search"
              type="text"
              placeholder="Cari {LEVEL_LABELS[level]}…"
              value={query[level]}
              oninput={(e) => onSearchInput(level, (e.currentTarget as HTMLInputElement).value)}
              autocomplete="off"
            />
            <div class="region-options">
              {#if loading[level]}
                <div class="region-empty">Memuat…</div>
              {:else if lists[level].length === 0}
                <div class="region-empty">Tidak ada hasil.</div>
              {:else}
                {#each lists[level] as opt}
                  <button
                    type="button"
                    class="region-option {selected[level]?.code === opt.code ? 'selected' : ''}"
                    role="option"
                    aria-selected={selected[level]?.code === opt.code}
                    onclick={() => pickRegion(level, opt)}
                  >
                    {opt.name}
                  </button>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .region-input {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .region-level {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .region-level-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-body);
  }

  .region-combo {
    position: relative;
  }

  /* Trigger mirrors .select-input chrome so it sits naturally beside the other
     question inputs. */
  .region-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    height: 52px;
    border: 1px solid transparent;
    border-radius: var(--radius-input);
    padding: 0 16px;
    font-family: var(--font);
    font-size: 16px;
    color: var(--text-primary);
    background: var(--canvas-soft);
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
  }

  .region-trigger.open {
    background: var(--canvas);
    border-color: var(--ink);
    border-width: 2px;
  }

  .region-trigger.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .region-trigger-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .region-trigger-text.placeholder {
    color: var(--text-muted);
  }

  .region-caret {
    flex-shrink: 0;
    color: var(--text-body);
    transition: transform 0.15s;
  }

  .region-trigger.open .region-caret {
    transform: rotate(180deg);
  }

  .region-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    z-index: 20;
    background: var(--canvas);
    border: 1px solid var(--surface-pressed);
    border-radius: var(--radius-input);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .region-search {
    width: 100%;
    height: 44px;
    border: none;
    border-bottom: 1px solid var(--canvas-soft);
    padding: 0 16px;
    font-family: var(--font);
    font-size: 15px;
    color: var(--text-primary);
    background: var(--canvas);
    outline: none;
  }

  .region-search::placeholder {
    color: var(--text-muted);
  }

  .region-options {
    max-height: 240px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .region-option {
    display: block;
    width: 100%;
    text-align: left;
    border: none;
    background: var(--canvas);
    padding: 12px 16px;
    font-family: var(--font);
    font-size: 15px;
    color: var(--text-primary);
    cursor: pointer;
    transition: background 0.12s;
  }

  .region-option:hover {
    background: var(--canvas-soft);
  }

  .region-option.selected {
    background: var(--ink);
    color: var(--on-ink);
  }

  .region-empty {
    padding: 14px 16px;
    font-size: 14px;
    color: var(--text-muted);
  }
</style>
