<script lang="ts">
  let { progress }: { progress: number } = $props()
</script>

<div class="progress-wrap">
  <div class="track">
    <div class="fill" style="width: {Math.min(100, Math.max(0, progress))}%"></div>
  </div>
</div>

<style>
  .progress-wrap {
    position: sticky;
    top: 0;
    z-index: 10;
    background: white;
    padding: 8px 0;
  }
  .track {
    height: 4px;
    background: #d9dde3;
    border-radius: 100px;
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: #f7bb00;
    border-radius: 100px;
    transition: width 0.3s ease;
  }
</style>
