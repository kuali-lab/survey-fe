import { describe, it, expect } from 'vitest'
import { sanitizePhoneInput, isValidPhoneFormat } from './phone.js'

describe('sanitizePhoneInput', () => {
  it('keeps digits unchanged', () => {
    expect(sanitizePhoneInput('081234567890')).toBe('081234567890')
  })

  it('strips letters', () => {
    expect(sanitizePhoneInput('1234567abc')).toBe('1234567')
  })

  it('strips symbols pasted alongside digits', () => {
    expect(sanitizePhoneInput('08115262=]../')).toBe('08115262')
  })

  it('strips whitespace and dashes', () => {
    expect(sanitizePhoneInput('0812 345-6789')).toBe('08123456789')
  })

  it('strips a leading plus sign', () => {
    expect(sanitizePhoneInput('+6281234567890')).toBe('6281234567890')
  })

  it('returns empty string when input is all non-digit', () => {
    expect(sanitizePhoneInput('abc=]../')).toBe('')
  })
})

describe('isValidPhoneFormat', () => {
  it('accepts a plain digit string within length range', () => {
    expect(isValidPhoneFormat('081234567')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isValidPhoneFormat('')).toBe(false)
  })

  it('rejects a string containing letters even if digit count is in range', () => {
    expect(isValidPhoneFormat('1234567abc')).toBe(false)
  })

  it('rejects a string containing symbols even if digit count is in range', () => {
    expect(isValidPhoneFormat('08115262=]../')).toBe(false)
  })

  it('rejects fewer than 7 digits', () => {
    expect(isValidPhoneFormat('123456')).toBe(false)
  })

  it('rejects more than 15 digits', () => {
    expect(isValidPhoneFormat('1234567890123456')).toBe(false)
  })

  it('accepts exactly 7 digits (lower bound)', () => {
    expect(isValidPhoneFormat('1234567')).toBe(true)
  })

  it('accepts exactly 15 digits (upper bound)', () => {
    expect(isValidPhoneFormat('123456789012345')).toBe(true)
  })
})
