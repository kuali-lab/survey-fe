<script lang="ts">
  type Props = {
    value: string
    onchange: (v: string) => void
    disabled?: boolean
    autofocus?: boolean
  }
  let { value, onchange, disabled = false, autofocus = false }: Props = $props()

  const LENGTH = 6
  let inputs: HTMLInputElement[] = $state([])

  const chars = $derived(
    Array.from({ length: LENGTH }, (_, i) => value[i] ?? '')
  )

  function handleInput(i: number, e: Event) {
    const target = e.target as HTMLInputElement
    const char = target.value.replace(/[^A-Za-z0-9]/g, '').slice(-1).toUpperCase()
    const arr = [...chars]
    arr[i] = char
    onchange(arr.join(''))
    if (char && i < LENGTH - 1) inputs[i + 1]?.focus()
  }

  function handleKeydown(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      inputs[i - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && i > 0) inputs[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < LENGTH - 1) inputs[i + 1]?.focus()
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault()
    const pasted = (e.clipboardData?.getData('text') ?? '')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, LENGTH)
    onchange(pasted.padEnd(value.length > pasted.length ? value.length : pasted.length, '').slice(0, LENGTH))
    const focusIdx = Math.min(pasted.length, LENGTH - 1)
    inputs[focusIdx]?.focus()
  }
</script>

<div class="boxes">
  {#each chars as char, i}
    <input
      bind:this={inputs[i]}
      type="text"
      inputmode="text"
      maxlength="1"
      value={char}
      {disabled}
      autofocus={autofocus && i === 0}
      class="box"
      class:filled={!!char}
      oninput={(e) => handleInput(i, e)}
      onkeydown={(e) => handleKeydown(i, e)}
      onpaste={handlePaste}
    />
  {/each}
</div>

<style>
  .boxes {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .box {
    width: 48px;
    height: 56px;
    border-radius: var(--radius-md);
    border: 2px solid var(--tertiary-30);
    background: white;
    font-family: var(--font);
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
    color: var(--tertiary-100);
    text-align: center;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .box.filled {
    border-color: var(--primary-50);
  }

  .box:focus {
    border-color: var(--primary-50);
    box-shadow: 0 0 0 3px rgba(247, 187, 0, 0.18);
  }

  .box:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 400px) {
    .boxes {
      gap: 6px;
    }
    .box {
      width: 40px;
      height: 50px;
      font-size: 20px;
    }
  }
</style>
