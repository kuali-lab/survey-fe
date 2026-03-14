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
    padding: 0 28px;
    border-radius: var(--radius-xl);
    font-family: var(--font);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    border: none;
    transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.1s, opacity 0.2s;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn.primary {
    background: var(--primary-50);
    color: #221500;
    border: 2px solid transparent;
  }

  .btn.primary:hover:not(:disabled) {
    background: #e8ae00;
  }

  .btn.secondary {
    background: white;
    color: var(--tertiary-80);
    border: 2px solid #d9dde3;
  }

  .btn.secondary:hover:not(:disabled) {
    border-color: #f7bb00;
    background: #fffbed;
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
