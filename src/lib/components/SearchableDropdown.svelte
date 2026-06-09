<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fade } from 'svelte/transition';

  import { fetchAsyncOptions } from '/api';

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
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debouncedSearch = searchQuery.toLowerCase();
    }, 150) as unknown as number;
  });

  let asyncOptions = $state<{label: string, isOther?: boolean}[]>([]);
  let isFetching = $state(false);

  $effect(() => {
    if (!hasAsyncOptions || !slug || !questionId) return;
    isFetching = true;
    fetchAsyncOptions(slug, questionId, debouncedSearch).then(opts => {
      asyncOptions = opts;
      isFetching = false;
    });
  });

  let filteredOptions = $derived(
    hasAsyncOptions
      ? asyncOptions
      : (debouncedSearch === '' 
        ? (options || [])
        : (options || []).filter(o => o.label.toLowerCase().includes(debouncedSearch)))
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

      {#if filteredOptions.length === 0}
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
        Menampilkan {filteredOptions.length > 50 ? '50+' : filteredOptions.length} hasil {hasAsyncOptions ? '' : dari ' + (options?.length || 0)}
        {#if isFetching}
          <span class="ml-2 animate-pulse">Memuat...</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .dropdown-wrapper {
    position: relative;
    width: 100%;
  }
  .dropdown-trigger {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .dropdown-trigger:focus, .dropdown-trigger:hover {
    border-color: rgba(255, 255, 255, 0.3);
    outline: none;
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
    background-color: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    z-index: 50;
    overflow: hidden;
  }
  .search-box {
    padding: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .search-icon {
    color: rgba(255, 255, 255, 0.5);
  }
  .search-box input {
    width: 100%;
    background: transparent;
    border: none;
    color: white;
    font-size: 0.875rem;
    outline: none;
  }
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
    color: rgba(255, 255, 255, 0.8);
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    height: 40px;
    display: flex;
    align-items: center;
  }
  .option-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }
  .option-item.selected {
    background-color: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }
  .empty-state {
    padding: 1rem;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.875rem;
  }
  .footer {
    padding: 0.5rem 1rem;
    background-color: rgba(0, 0, 0, 0.2);
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.4);
    text-align: right;
  }
  
  .options-container::-webkit-scrollbar {
    width: 8px;
  }
  .options-container::-webkit-scrollbar-track {
    background: transparent;
  }
  .options-container::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }
</style>





