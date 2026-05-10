<script lang="ts">
  type Props = {
    displayName: string
    onlogout: () => void
  }
  let { displayName, onlogout }: Props = $props()
</script>

<div class="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
  <span class="text-amber-800 font-medium">
    Mensurvei sebagai: <strong>{displayName}</strong>
  </span>
  <button
    onclick={onlogout}
    class="text-amber-700 hover:text-amber-900 underline text-xs font-medium"
  >
    Keluar
  </button>
</div>
