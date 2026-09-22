import { describe, it, expect } from 'vitest'
import { toggleOption } from './SearchableDropdown.svelte'

// Pure toggle-membership logic for dropdown multi-select mode (§A). Kept as a
// named export from `<script module>` so it's testable without mounting the
// component — this repo's vitest runs in a DOM-less `node` environment (see
// vitest.config.ts), so nothing that needs a live DOM can be unit-tested here.
describe('toggleOption', () => {
  it('adds a key not yet present', () => {
    expect(toggleOption([], 'A')).toEqual(['A'])
    expect(toggleOption(['A'], 'B')).toEqual(['A', 'B'])
  })

  it('removes a key already present', () => {
    expect(toggleOption(['A', 'B'], 'A')).toEqual(['B'])
    expect(toggleOption(['A'], 'A')).toEqual([])
  })

  it('does not mutate the input array', () => {
    const current = ['A']
    const next = toggleOption(current, 'B')
    expect(current).toEqual(['A'])
    expect(next).toEqual(['A', 'B'])
  })

  it('treats keys as exact matches (case/whitespace sensitive, like optionKey callers expect)', () => {
    expect(toggleOption(['A'], 'a')).toEqual(['A', 'a'])
    expect(toggleOption(['A '], 'A')).toEqual(['A ', 'A'])
  })
})
