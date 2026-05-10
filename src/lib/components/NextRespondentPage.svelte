<script lang="ts">
  type Props = {
    onnext: () => void
    onfinish: () => void
  }
  let { onnext, onfinish }: Props = $props()
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-6">
  <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
    <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </div>

  <div>
    <h2 class="text-xl font-semibold text-gray-900">Jawaban tersimpan ✓</h2>
    <p class="text-gray-500 mt-1 text-sm">Jawaban responden berhasil direkam.</p>
  </div>

  <div class="flex flex-col gap-3 w-full max-w-xs">
    <button
      onclick={onnext}
      class="w-full py-3 px-6 rounded-xl bg-primary text-white font-semibold text-sm hover:brightness-95 transition-all"
    >
      Mulai Responden Berikutnya
    </button>
    <button
      onclick={onfinish}
      class="w-full py-3 px-6 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-all"
    >
      Selesai
    </button>
  </div>
</div>
