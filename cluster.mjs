// Cluster wrapper for the SvelteKit adapter-node server.
//
// The respondent SSR render is single-threaded per Node process; one process
// can only use one CPU core. This forks WEB_CONCURRENCY workers that share the
// listening socket (Node cluster round-robins connections), so survey page opens
// scale across cores instead of pinning one. Default 2 — leaves cores for
// logika-be (submits) and Traefik on the shared 4-vCPU box. Tune via WEB_CONCURRENCY.
import cluster from 'node:cluster'

const workers = Number(process.env.WEB_CONCURRENCY) || 2

if (cluster.isPrimary) {
  console.log(`[cluster] primary ${process.pid} starting ${workers} worker(s)`)
  for (let i = 0; i < workers; i++) cluster.fork()
  cluster.on('exit', (worker, code, signal) => {
    console.log(`[cluster] worker ${worker.process.pid} exited (${signal || code}) — respawning`)
    cluster.fork()
  })
} else {
  // Each worker runs the adapter-node server; listen() is shared via the primary.
  import('./build/index.js')
}
