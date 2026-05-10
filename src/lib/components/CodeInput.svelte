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

<div class="flex gap-2 justify-center">
  {#each chars as char, i}
    <input
      bind:this={inputs[i]}
      type="text"
      inputmode="text"
      maxlength="1"
      value={char}
      {disabled}
      autofocus={autofocus && i === 0}
      class="w-11 h-14 text-center text-xl font-mono font-bold border-2 rounded-lg outline-none transition-colors
             {char ? 'border-primary text-gray-900' : 'border-gray-300 text-gray-400'}
             focus:border-primary focus:ring-2 focus:ring-primary/20
             disabled:opacity-50 disabled:cursor-not-allowed"
      oninput={(e) => handleInput(i, e)}
      onkeydown={(e) => handleKeydown(i, e)}
      onpaste={handlePaste}
    />
  {/each}
</div>
