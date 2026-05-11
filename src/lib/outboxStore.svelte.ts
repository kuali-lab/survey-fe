import { outbox, onOutboxChange, type OutboxItem } from './outbox.js'

class OutboxStore {
  items = $state<OutboxItem[]>([])
  pendingCount = $state(0)
  sendingCount = $state(0)
  permanentFailCount = $state(0)
  online = $state(true)
  lastSentAt = $state<number | null>(null)
  initialized = false

  init() {
    if (this.initialized) return
    this.initialized = true
    if (typeof window !== 'undefined') {
      this.online = navigator.onLine
      window.addEventListener('online', () => { this.online = true })
      window.addEventListener('offline', () => { this.online = false })
    }
    onOutboxChange(() => { void this.refresh() })
    void this.refresh()
  }

  async refresh() {
    try {
      const all = await outbox.list()
      this.items = all
      this.pendingCount = all.filter((i) => i.status === 'pending').length
      this.sendingCount = all.filter((i) => i.status === 'sending').length
      this.permanentFailCount = all.filter((i) => i.status === 'permanent_fail').length
      const sent = all.filter((i) => i.status === 'sent' && i.sentAt)
      this.lastSentAt = sent.length ? Math.max(...sent.map((i) => i.sentAt ?? 0)) : null
    } catch {
      // IDB unavailable (private mode?) — leave defaults; UI will degrade gracefully.
    }
  }

  getBySubmissionId(submissionId: string): OutboxItem | undefined {
    return this.items.find((i) => i.submissionId === submissionId)
  }
}

export const outboxStore = new OutboxStore()

if (typeof window !== 'undefined') {
  outboxStore.init()
}
