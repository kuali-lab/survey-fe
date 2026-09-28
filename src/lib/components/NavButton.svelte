<script lang="ts">
  let {
    label,
    onClick,
    variant,
    disabled = false,
    loading = false
  }: {
    label: string
    onClick: () => void
    variant: 'primary' | 'secondary'
    disabled?: boolean
    loading?: boolean
  } = $props()
</script>

<button
  class="btn {variant}"
  type="button"
  onclick={onClick}
  disabled={disabled || loading}
  aria-disabled={disabled || loading}
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {/if}
  <span class="label">{label}</span>
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 48px;
    padding: 0 24px;
    border-radius: var(--radius-pill);
    font-family: var(--font);
    font-size: 16px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  @media (prefers-reduced-motion: no-preference) {
    .btn:active:not(:disabled) {
      transform: scale(0.97);
    }
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  .btn.primary {
    background: var(--ink);
    color: var(--on-ink);
  }
  .btn.primary:hover:not(:disabled) {
    background: var(--ink-elevated);
  }

  .btn.secondary {
    background: var(--canvas);
    color: var(--tertiary-100);
    border-color: var(--tertiary-100);
  }
  .btn.secondary:hover:not(:disabled) {
    background: var(--surface);
  }

  .spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .label {
    white-space: nowrap;
  }
</style>
