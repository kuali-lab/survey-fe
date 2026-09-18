<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fade } from 'svelte/transition';

  import { fetchAsyncOptions } from '$lib/api';
  import { optionFilterKey, type OptionFilter } from '$lib/optionFilter';
  import { useI18n } from '$lib/i18n/context.js';
  import type { TranslatedText } from '$lib/types.js';

  let {
    options = [], value = '', onChange, placeholder = '', hasAsyncOptions = false, questionId = '', slug = '',
    filterActive = false, filter = null, filterHint = '', filterEmptyMessage = '',
    disabled = false, notice = '',
  } = $props<{
    // `label` = NILAI yang dipancarkan lewat onChange (bahasa utama). `translations`
    // hanya memengaruhi teks yang ditampilkan dan dicari.
    options?: { label: string, isOther?: boolean, translations?: TranslatedText }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    hasAsyncOptions?: boolean;
    questionId?: string;
    slug?: string;
    // Daftar Pilihan Bersaring (contract §8). `filterActive` = the question
    // carries a filterConfig; `filter` = the resolved params (null while any
    // source question is unanswered → control disabled, `filterHint` shown);
    // `filterEmptyMessage` replaces the generic empty state when the filtered
    // first page comes back empty.
    filterActive?: boolean;
    filter?: OptionFilter | null;
    filterHint?: string;
    filterEmptyMessage?: string;
    // Pilihan Bertingkat (manual option list narrowed by a parent answer):
    // `disabled` = parent unanswered (shows `filterHint`); `notice` = a
    // persistent line under the control, e.g. the "Tidak ada pilihan untuk …"
    // message when the parent answer allows nothing.
    disabled?: boolean;
    notice?: string;
  }>();

  // Disabled until every source answer is present. The catalog filter only
  // applies to async dropdowns; `disabled` covers local dependent lists.
  let filterBlocked = $derived(disabled || (filterActive && hasAsyncOptions && !filter));
  // Stable identity so the fetch effect re-runs only when the params change.
  let filterKey = $derived(optionFilterKey(filter));

  const i18n = useI18n();
  type Opt = { label: string, isOther?: boolean, translations?: TranslatedText };
  /** Nilai tersimpan (label bahasa utama) → teks tampilannya. Teks bebas "Lainnya" tampil apa adanya. */
  let selectedText = $derived.by(() => {
    if (!value) return '';
    const match = ((options || []) as Opt[]).find((o) => o.label === value);
    return match ? i18n.label(match) : value;
  });

  let isOpen = $state(false);
  let searchQuery = $state('');
  let searchInput: HTMLInputElement;
  
  // Create debounced search to avoid lagging with 100k items
  let debouncedSearch = $state('');
  let timeoutId: number;
  
  $effect(() => {
    const q = searchQuery.toLowerCase();
    // Local options filter instantly (realtime); only async fetches are debounced.
    if (!hasAsyncOptions) {
      debouncedSearch = q;
      return;
    }
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debouncedSearch = q;
    }, 300) as unknown as number;
  });

  // Reset the virtual-scroll window whenever the search changes — a stale
  // startIndex left over from prior scrolling would otherwise render an empty
  // slice and make it look like search "isn't working".
  $effect(() => {
    debouncedSearch;
    startIndex = 0;
    if (scrollContainer) scrollContainer.scrollTop = 0;
  });

  let asyncOptions = $state<{label: string, isOther?: boolean}[]>([]);
  let isFetching = $state(false);
  let asyncOffset = $state(0);
  let asyncHasMore = $state(false);
  const ASYNC_LIMIT = 50;
  // Must match the server-side minSearchChars guard: a 1–2 char infix search on
  // a huge option set (287k-row school lists) forces a full scan and saturates
  // the DB, so we don't even fire the request for terms this short.
  const MIN_SEARCH_CHARS = 3;

  // True when the user typed a non-empty term below the minimum — we skip the
  // fetch and show a hint instead (empty term still loads the first page).
  // A filtered request already narrows the scan (contract §3 lifts the server
  // minimum too), so the guard applies only to unfiltered async searches.
  let searchTooShort = $derived(
    !filter && debouncedSearch.length > 0 && debouncedSearch.length < MIN_SEARCH_CHARS
  );

  // First page: (re)load whenever the (debounced) search, question identity or
  // filter params change. Accumulates further pages via loadMoreAsync() on
  // scroll. A stale response (filter changed mid-flight) is discarded.
  $effect(() => {
    if (!hasAsyncOptions || !slug || !questionId) return;
    const q = debouncedSearch;
    const key = filterKey;
    const f = filter;
    if (filterBlocked) {
      asyncOptions = [];
      asyncHasMore = false;
      asyncOffset = 0;
      isFetching = false;
      return;
    }
    // Mirror the BE guard: keep too-short searches off the wire entirely.
    if (!f && q.length > 0 && q.length < MIN_SEARCH_CHARS) {
      asyncOptions = [];
      asyncHasMore = false;
      asyncOffset = 0;
      isFetching = false;
      return;
    }
    asyncOffset = 0;
    isFetching = true;
    fetchAsyncOptions(slug, questionId, q, ASYNC_LIMIT, 0, f).then(opts => {
      if (key !== filterKey || q !== debouncedSearch) return;
      asyncOptions = opts;
      asyncHasMore = opts.length === ASYNC_LIMIT;
      isFetching = false;
    });
  });

  async function loadMoreAsync() {
    if (!hasAsyncOptions || isFetching || !asyncHasMore) return;
    isFetching = true;
    const next = asyncOffset + ASYNC_LIMIT;
    const opts = await fetchAsyncOptions(slug, questionId, debouncedSearch, ASYNC_LIMIT, next, filter);
    asyncOffset = next;
    asyncOptions = [...asyncOptions, ...opts];
    asyncHasMore = opts.length === ASYNC_LIMIT;
    isFetching = false;
  }

  let filteredOptions = $derived(
    hasAsyncOptions
      ? asyncOptions
      : (debouncedSearch === '' 
        ? (options || [])
        : (options || []).filter((o: Opt) => o.label.toLowerCase().includes(debouncedSearch) || i18n.label(o).toLowerCase().includes(debouncedSearch)))
  );

  // Virtual scrolling
  let visibleCount = 30;
  let startIndex = $state(0);
  let scrollContainer: HTMLDivElement;
  let dropdownMenu: HTMLDivElement;

  let visibleOptions = $derived(filteredOptions.slice(startIndex, startIndex + visibleCount));

  function handleScroll() {
    if (!scrollContainer) return;
    const scrollTop = scrollContainer.scrollTop;
    const itemHeight = 40;
    startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
    // Infinite scroll for async sets: pull the next page as the user nears the end.
    if (hasAsyncOptions && scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - itemHeight * 3) {
      loadMoreAsync();
    }
  }

  function selectOption(label: string) {
    onChange(label);
    isOpen = false;
    searchQuery = '';
  }

  async function toggleOpen() {
    if (filterBlocked) return;
    isOpen = !isOpen;
    if (isOpen) {
      searchQuery = '';
      debouncedSearch = '';
      await tick();
      if (searchInput) searchInput.focus();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isOpen = false;
    }
  }

  // Handle click outside
  function handleWindowClick(e: MouseEvent) {
    if (isOpen && dropdownMenu && !dropdownMenu.contains(e.target as Node) && !(e.target as Element).closest('.dropdown-trigger')) {
      isOpen = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="dropdown-wrapper" onkeydown={handleKeydown}>
  <button
    type="button"
    class="dropdown-trigger"
    class:disabled={filterBlocked}
    disabled={filterBlocked}
    aria-disabled={filterBlocked}
    onclick={toggleOpen}
  >
    <span class="truncate">{selectedText || placeholder || i18n.t('ddPlaceholder')}</span>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>

  {#if isOpen}
    <div class="dropdown-menu" bind:this={dropdownMenu} transition:fade={{ duration: 100 }}>
      <div class="search-box">
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          bind:this={searchInput}
          bind:value={searchQuery}
          type="text" 
          placeholder={i18n.t('ddSearch')} 
        />
      </div>

      {#if searchTooShort}
        <div class="empty-state">{i18n.t('ddMinChars', { n: MIN_SEARCH_CHARS })}</div>
      {:else if filteredOptions.length === 0 && isFetching}
        <div class="empty-state">{i18n.t('ddLoading')}</div>
      {:else if filteredOptions.length === 0 && (filter || !hasAsyncOptions) && filterEmptyMessage && debouncedSearch === ''}
        <div class="empty-state filter-empty">{filterEmptyMessage}</div>
      {:else if filteredOptions.length === 0}
        <div class="empty-state">{i18n.t('ddEmpty')}</div>
      {:else}
        <div 
          class="options-container" 
          bind:this={scrollContainer}
          onscroll={handleScroll}
        >
          <div class="virtual-spacer" style="height: {filteredOptions.length * 40}px;">
            <div class="visible-items" style="transform: translateY({startIndex * 40}px);">
              {#each visibleOptions as opt (opt.label)}
                <button 
                  type="button" 
                  class="option-item" 
                  class:selected={value === opt.label}
                  onclick={() => selectOption(opt.label)}
                >
                  <span class="truncate">{i18n.label(opt)}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}
      <div class="footer">
        Menampilkan {filteredOptions.length}{hasAsyncOptions && asyncHasMore ? '+' : ''} hasil {hasAsyncOptions ? '' : ' dari ' + (options?.length || 0)}
        {#if isFetching}
          <span class="ml-2 animate-pulse">{i18n.t('ddLoading')}</span>
        {/if}
      </div>
    </div>
  {/if}

  {#if filterBlocked && filterHint}
    <p class="filter-hint">{filterHint}</p>
  {:else if notice}
    <p class="filter-hint filter-notice">{notice}</p>
  {/if}
</div>

<style>
  /* Styled to match the light survey theme (.select-input / .text-input).
     Previously hardcoded dark colors made the control invisible on the white
     survey canvas. */
  .dropdown-wrapper {
    position: relative;
    width: 100%;
    /* Breathing room below so a dropdown that is the last question is not flush
       against the bottom of the screen. */
    margin-bottom: 24px;
  }
  .dropdown-trigger {
    width: 100%;
    height: 52px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    background: var(--canvas-soft);
    /* Thin outline to separate the control from the page background. */
    border: 1px solid var(--hairline);
    border-radius: var(--radius-input);
    color: var(--text-primary);
    font-family: var(--font);
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s;
  }
  .dropdown-trigger svg { color: var(--text-body); flex-shrink: 0; }
  /* Mirrors RegionInput's disabled trigger: waiting on the source questions. */
  .dropdown-trigger.disabled,
  .dropdown-trigger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .dropdown-trigger:disabled:hover {
    background: var(--canvas-soft);
    border-color: var(--hairline);
  }
  .filter-hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .filter-hint.filter-notice {
    color: var(--text-body);
    line-height: 1.5;
  }
  .empty-state.filter-empty {
    color: var(--text-body);
    line-height: 1.5;
    white-space: normal;
  }
  .dropdown-trigger:focus, .dropdown-trigger:hover {
    outline: none;
    background: var(--canvas);
    border-color: var(--ink);
  }
  .truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    right: 0;
    background: var(--canvas);
    border: 1px solid var(--canvas-soft);
    border-radius: var(--radius-input);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
    z-index: 50;
    overflow: hidden;
  }
  .search-box {
    padding: 0.75rem;
    background: var(--primary-10);
    border-bottom: 2px solid var(--primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .search-icon {
    color: var(--primary-text);
    flex-shrink: 0;
  }
  .search-box input {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--text-primary);
    caret-color: var(--primary);
    font-family: var(--font);
    font-size: 0.9375rem;
    outline: none;
  }
  .search-box input::placeholder { color: var(--text-muted); }
  .options-container {
    max-height: 240px;
    overflow-y: auto;
    position: relative;
  }
  .virtual-spacer {
    position: relative;
    width: 100%;
  }
  .visible-items {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    width: 100%;
  }
  .option-item {
    width: 100%;
    text-align: left;
    padding: 0 1rem;
    color: var(--text-body);
    background: transparent;
    border: none;
    cursor: pointer;
    font-family: var(--font);
    font-size: 0.9375rem;
    height: 40px;
    display: flex;
    align-items: center;
  }
  .option-item:hover {
    background: var(--primary-10);
  }
  .option-item.selected {
    background: var(--primary-20);
    color: var(--primary-text);
    font-weight: 600;
  }
  .empty-state {
    padding: 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
  .footer {
    padding: 0.5rem 1rem;
    background: var(--canvas-soft);
    font-size: 0.75rem;
    color: var(--text-muted);
    text-align: right;
  }

  .options-container::-webkit-scrollbar {
    width: 8px;
  }
  .options-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .options-container::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }
</style>





