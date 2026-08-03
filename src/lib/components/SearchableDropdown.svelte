<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fade } from 'svelte/transition';

  import { fetchAsyncOptions } from '$lib/api';

  let { options = [], value = '', onChange, placeholder = '-- Pilih salah satu --', hasAsyncOptions = false, questionId = '', slug = '' } = $props<{
    options?: { label: string, isOther?: boolean }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    hasAsyncOptions?: boolean;
    questionId?: string;
    slug?: string;
  }>();

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
  let searchTooShort = $derived(
    debouncedSearch.length > 0 && debouncedSearch.length < MIN_SEARCH_CHARS
  );

  // First page: (re)load whenever the (debounced) search or question identity
  // changes. Accumulates further pages via loadMoreAsync() on scroll.
  $effect(() => {
    if (!hasAsyncOptions || !slug || !questionId) return;
    const q = debouncedSearch;
    // Mirror the BE guard: keep too-short searches off the wire entirely.
    if (q.length > 0 && q.length < MIN_SEARCH_CHARS) {
      asyncOptions = [];
      asyncHasMore = false;
      asyncOffset = 0;
      isFetching = false;
      return;
    }
    asyncOffset = 0;
    isFetching = true;
    fetchAsyncOptions(slug, questionId, q, ASYNC_LIMIT, 0).then(opts => {
      asyncOptions = opts;
      asyncHasMore = opts.length === ASYNC_LIMIT;
      isFetching = false;
    });
  });

  async function loadMoreAsync() {
    if (!hasAsyncOptions || isFetching || !asyncHasMore) return;
    isFetching = true;
    const next = asyncOffset + ASYNC_LIMIT;
    const opts = await fetchAsyncOptions(slug, questionId, debouncedSearch, ASYNC_LIMIT, next);
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
        : (options || []).filter((o: { label: string, isOther?: boolean }) => o.label.toLowerCase().includes(debouncedSearch)))
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
    onclick={toggleOpen}
  >
    <span class="truncate">{value || placeholder}</span>
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
          placeholder="Cari pilihan..." 
        />
      </div>

      {#if searchTooShort}
        <div class="empty-state">Ketik minimal {MIN_SEARCH_CHARS} huruf untuk mencari.</div>
      {:else if filteredOptions.length === 0}
        <div class="empty-state">Tidak ada pilihan yang cocok.</div>
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
                  <span class="truncate">{opt.label}</span>
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}
      <div class="footer">
        Menampilkan {filteredOptions.length}{hasAsyncOptions && asyncHasMore ? '+' : ''} hasil {hasAsyncOptions ? '' : ' dari ' + (options?.length || 0)}
        {#if isFetching}
          <span class="ml-2 animate-pulse">Memuat...</span>
        {/if}
      </div>
    </div>
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





