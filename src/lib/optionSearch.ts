/**
 * Shared search interaction — the debounce timing and min-chars gate used by
 * BOTH SearchableDropdown.svelte (single AND multi-select, §A) and checkbox's
 * own search box (§C). Pulled out so the two controls feel identical
 * regardless of how many options sit behind them: the 300ms debounce + 3-char
 * minimum that used to guard only the async/catalog dropdown path now wraps
 * every search box, local or not (design doc §C, the cross-cutting
 * decision). Kept free of Svelte so it's testable in Node (this repo's
 * vitest runs DOM-less, see vitest.config.ts).
 */

/**
 * Must match the server-side guard (`internal/handler/public_survey_options.go`
 * `minSearchChars`) — a 1–2 char infix search on a huge catalog (287k-row
 * school lists) forces a full scan. Local (small) lists don't need the guard
 * for performance, but get it anyway so the interaction feels the same
 * everywhere.
 */
export const MIN_SEARCH_CHARS = 3

/** One debounce timing everywhere a search box exists. */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * Case-insensitive substring match against one or more searchable strings per
 * item (e.g. the raw label AND its i18n-translated display text — the
 * behavior `SearchableDropdown.svelte`'s local branch already had before
 * extraction). An empty/whitespace-only query returns every item unfiltered.
 */
export function filterBySearch<T>(items: T[], query: string, getSearchText: (item: T) => string[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => getSearchText(item).some((text) => text.toLowerCase().includes(q)))
}

/**
 * A question's search minimum — `MIN_SEARCH_CHARS` (3), lowered only far
 * enough to keep its shortest option label (or translation) reachable. A flat
 * 3-char floor would make "Ya" or "RT" unsearchable forever once "Sembunyikan
 * Opsi" hides the list until something is typed.
 *
 * Local lists only — the async/catalog path keeps the flat `MIN_SEARCH_CHARS`,
 * a server-side guard this must never loosen.
 */
export function effectiveMinChars<T>(items: T[], getSearchText: (item: T) => string[]): number {
  let shortest = MIN_SEARCH_CHARS
  for (const item of items) {
    for (const text of getSearchText(item)) {
      const len = text.trim().length
      if (len > 0 && len < shortest) shortest = len
    }
  }
  return Math.max(1, shortest)
}

/**
 * A debounced wrapper around `fn` — the SAME timer is reused across calls
 * (unlike calling `debounce()` fresh inside a reactive block, which would
 * create a new, never-cancelled timer every time). Create it once per
 * consumer and call the returned function on every keystroke.
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), ms)
  }
}
