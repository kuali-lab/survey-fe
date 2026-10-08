import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// QuestionCard tak bisa dirender SSR di vitest (QuestionInput memuat lucide-svelte non-runes),
// jadi dijaga dari sumber: tata letak gambar lewat satu keputusan murni (uji di table.spec.ts).
const src = readFileSync(fileURLToPath(new URL('./QuestionCard.svelte', import.meta.url)), 'utf8')

describe('QuestionCard — tata letak gambar', () => {
  it('cabang gambar samping membaca effectiveImageLayout, bukan question.imageLayout mentah', () => {
    expect(src).toContain('const imageLayout = $derived(effectiveImageLayout(question))')
    expect(src).toContain("{#if imageLayout === 'left' || imageLayout === 'right'}")
    expect(src).toContain('card-inline-{imageLayout}')
    expect(src).not.toContain('question.imageLayout')
  })
})
