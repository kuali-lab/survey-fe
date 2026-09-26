import { describe, it, expect } from 'vitest'
import { render } from 'svelte/server'
import InviteBlockedPage from './InviteBlockedPage.svelte'

const LOGO = 'https://cdn.example.test/logo-klien.png'

describe('InviteBlockedPage — state "link" (M6a)', () => {
  it('renders the branch-link gate copy with the survey logo', () => {
    const { body } = render(InviteBlockedPage, {
      props: { state: 'link', title: 'Survei X', logoUrl: LOGO },
    })
    expect(body).toContain('Tautan ini tidak berlaku')
    expect(body).toContain('petugas yang membagikannya')
    expect(body).toContain(LOGO)
  })

  it('does not mention the invitation-expiry copy', () => {
    const { body } = render(InviteBlockedPage, { props: { state: 'link', title: 'Survei X' } })
    expect(body).not.toContain('kedaluwarsa')
  })

  it('shows the eyebrow only when a title is given', () => {
    const withTitle = render(InviteBlockedPage, { props: { state: 'link', title: 'Survei X' } }).body
    const noTitle = render(InviteBlockedPage, { props: { state: 'link' } }).body
    expect(withTitle).toContain('Tautan tidak berlaku')
    expect(noTitle).not.toContain('class="eyebrow')
  })

  it('defaults linkReason to "invalid" (old callers unaffected)', () => {
    const { body } = render(InviteBlockedPage, { props: { state: 'link', title: 'Survei X' } })
    expect(body).toContain('Tautan ini tidak berlaku')
  })
})

describe('InviteBlockedPage — state "link", linkReason "required" (Ihatec F1)', () => {
  it('renders the required-link-code gate copy instead of the invalid-link copy', () => {
    const { body } = render(InviteBlockedPage, {
      props: { state: 'link', linkReason: 'required', title: 'Survei X', logoUrl: LOGO },
    })
    expect(body).toContain('Survei ini hanya bisa diisi lewat tautan petugas')
    expect(body).toContain('Pakai tautan atau QR yang dibagikan petugas. Tautan umum tidak menerima jawaban.')
    expect(body).toContain(LOGO)
    expect(body).not.toContain('Tautan ini tidak berlaku')
  })
})

describe('InviteBlockedPage — existing states unchanged', () => {
  it('expired still renders the invitation-expiry copy', () => {
    const { body } = render(InviteBlockedPage, { props: { state: 'expired', title: 'Survei X' } })
    expect(body).toContain('kedaluwarsa')
    expect(body).not.toContain('petugas yang membagikannya')
  })

  it('done still renders the completed copy', () => {
    const { body } = render(InviteBlockedPage, { props: { state: 'done', title: 'Survei X' } })
    expect(body).toContain('Survei telah selesai')
  })

  it('device still renders the per-device copy', () => {
    const { body } = render(InviteBlockedPage, { props: { state: 'device', title: 'Survei X' } })
    expect(body).toContain('perangkat ini')
  })
})
