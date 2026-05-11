<script lang="ts">
  import type { Question, Answers, AnswerValue, QuestionOption, ContactInfo } from '$lib/types.js'

  type Props = {
    questions: Question[]
    answers: Answers
    onEdit: (questionId: string) => void
  }
  let { questions, answers, onEdit }: Props = $props()

  const NON_ANSWERABLE = new Set(['statement', 'welcome_page', 'closing_page', 'question_group'])

  const visible = $derived(questions.filter((q) => !NON_ANSWERABLE.has(q.type)))

  function optionLabel(q: Question, id: string): string {
    const opt = q.options?.find((o) => o.id === id)
    return opt?.label ?? id
  }

  function isContactInfo(v: unknown): v is ContactInfo {
    return typeof v === 'object' && v !== null && !Array.isArray(v) && 'firstName' in v
  }

  function formatAnswer(q: Question, a: AnswerValue): string {
    if (a === null || a === undefined || a === '') return '—'

    switch (q.type) {
      case 'rating': {
        const v = Number(a)
        const max = q.maxStars ?? 5
        if (Number.isNaN(v)) return String(a)
        const stars = '★'.repeat(v) + '☆'.repeat(Math.max(0, max - v))
        return `${stars} (${v} dari ${max})`
      }
      case 'nps':
      case 'opinion_scale': {
        const v = Number(a)
        const max = q.maxValue ?? (q.type === 'nps' ? 10 : 5)
        if (Number.isNaN(v)) return String(a)
        return `${v}/${max}`
      }
      case 'yes_no': {
        return a === 'yes' ? 'Ya' : a === 'no' ? 'Tidak' : String(a)
      }
      case 'single_choice':
      case 'dropdown':
      case 'image_choice': {
        return String(a)
      }
      case 'checkbox': {
        if (Array.isArray(a)) return a.join(', ')
        return String(a)
      }
      case 'matrix': {
        if (typeof a === 'object' && a !== null && !Array.isArray(a) && !isContactInfo(a)) {
          const obj = a as Record<string, string>
          const rows = q.matrixRows ?? []
          const cols = q.matrixCols ?? []
          const lines: string[] = []
          for (const r of rows) {
            const colId = obj[r.id]
            if (!colId) continue
            const col = cols.find((c) => c.id === colId)
            lines.push(`${r.label}: ${col?.label ?? colId}`)
          }
          return lines.length > 0 ? lines.join(' · ') : '—'
        }
        return String(a)
      }
      case 'contact_info': {
        if (isContactInfo(a)) {
          const parts = [
            `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim(),
            a.phone,
            a.email,
          ].filter((v) => v && v.trim() !== '')
          return parts.join(' · ') || '—'
        }
        return String(a)
      }
      case 'file_upload': {
        return typeof a === 'string' && a !== '__uploading__' ? `[Berkas terunggah] ${a}` : '[Berkas]'
      }
      default:
        return Array.isArray(a) ? a.join(', ') : String(a)
    }
  }
</script>

<div class="recap" role="list">
  {#each visible as q, i (q.id)}
    <div class="row" role="listitem">
      <div class="qhead">
        <span class="qnum">{i + 1}.</span>
        <span class="qtitle">{q.title}</span>
        <button class="edit-btn" type="button" onclick={() => onEdit(q.id)} aria-label="Edit pertanyaan ini">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          <span>Edit</span>
        </button>
      </div>
      <div class="answer">{formatAnswer(q, answers[q.id] ?? null)}</div>
    </div>
  {/each}
</div>

<style>
  .recap {
    background: white;
    border: 1px solid var(--tertiary-30);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .row {
    padding: 14px 16px;
    border-bottom: 1px solid var(--tertiary-30);
  }

  .row:last-child {
    border-bottom: none;
  }

  .qhead {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 6px;
  }

  .qnum {
    font-size: 13px;
    font-weight: 700;
    color: var(--tertiary-70);
    flex-shrink: 0;
    line-height: 1.4;
  }

  .qtitle {
    flex: 1;
    font-size: 14px;
    font-weight: 600;
    color: var(--tertiary-100);
    line-height: 1.4;
  }

  .edit-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid var(--tertiary-30);
    border-radius: var(--radius-sm);
    padding: 3px 8px;
    color: var(--tertiary-70);
    font-family: var(--font);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .edit-btn:hover {
    background: var(--primary-10);
    border-color: var(--primary-30);
    color: #b45309;
  }

  .answer {
    font-size: 14px;
    color: var(--tertiary-80);
    line-height: 1.5;
    padding-left: 22px;
    word-break: break-word;
  }
</style>
