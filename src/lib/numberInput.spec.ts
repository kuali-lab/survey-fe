import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { applyNumberInput, numberInputText, numberInputCompare } from './numberInput.js'

describe('applyNumberInput — leading zeros', () => {
  it('keeps a leading-zero identifier intact (NISN)', () => {
    const r = applyNumberInput('0076359761', {})
    expect(r.value).toBe('0076359761')
    expect(r.text).toBe('0076359761')
    expect(r.warn).toBeNull()
  })

  it('keeps every leading zero, however many', () => {
    expect(applyNumberInput('000123', {}).value).toBe('000123')
    expect(applyNumberInput('0000000001', {}).value).toBe('0000000001')
  })

  it('leaves an ordinary number looking exactly as typed', () => {
    const r = applyNumberInput('42', {})
    expect(r.value).toBe('42')
    expect(r.text).toBe('42')
    expect(r.warn).toBeNull()
  })

  it('keeps decimals as typed', () => {
    expect(applyNumberInput('3.14', {}).value).toBe('3.14')
    expect(applyNumberInput('0.5', {}).value).toBe('0.5')
  })

  it('keeps a negative number as typed', () => {
    expect(applyNumberInput('-5', {}).value).toBe('-5')
  })
})

describe('applyNumberInput — zero is a real answer', () => {
  it('treats "0" as an answer, not as empty', () => {
    const r = applyNumberInput('0', {})
    expect(r.value).toBe('0')
    expect(r.value).not.toBeNull()
    expect(r.text).toBe('0')
  })

  it('reports an empty field as null (cleared answer)', () => {
    const r = applyNumberInput('', {})
    expect(r.value).toBeNull()
    expect(r.text).toBe('')
  })

  it('accepts "0" when minValue is 0', () => {
    const r = applyNumberInput('0', { minValue: 0 })
    expect(r.value).toBe('0')
    expect(r.warn).toBeNull()
  })
})

describe('applyNumberInput — maxLength truncation', () => {
  it('truncates while typing (type=number ignores native maxlength)', () => {
    const r = applyNumberInput('00763597612345', { maxLength: 10 })
    expect(r.text).toBe('0076359761')
    expect(r.value).toBe('0076359761')
  })

  it('counts leading zeros as characters', () => {
    const r = applyNumberInput('00123', { maxLength: 3 })
    expect(r.text).toBe('001')
    expect(r.value).toBe('001')
  })

  it('leaves a short value untouched', () => {
    expect(applyNumberInput('123', { maxLength: 10 }).text).toBe('123')
  })
})

describe('applyNumberInput — maxValue hard cap while typing', () => {
  it('clamps down to maxValue and says so', () => {
    const r = applyNumberInput('150', { maxValue: 100 })
    expect(r.text).toBe('100')
    expect(r.value).toBe('100')
    expect(r.warn).toBe('Nilai maksimal 100.')
  })

  it('does not clamp a value exactly at maxValue', () => {
    const r = applyNumberInput('100', { maxValue: 100 })
    expect(r.value).toBe('100')
    expect(r.warn).toBeNull()
  })

  it('compares numerically, so leading zeros do not trip the cap', () => {
    const r = applyNumberInput('0099', { maxValue: 100 })
    expect(r.value).toBe('0099')
    expect(r.warn).toBeNull()
  })

  it('truncates by maxLength first, then caps', () => {
    // '999' -> maxLength 2 -> '99' -> under a cap of 100, so no clamp.
    const r = applyNumberInput('999', { maxLength: 2, maxValue: 100 })
    expect(r.text).toBe('99')
    expect(r.warn).toBeNull()
  })
})

describe('applyNumberInput — minValue warns but never clamps while typing', () => {
  it('warns without clamping so multi-digit entry stays possible', () => {
    const r = applyNumberInput('1', { minValue: 10 })
    expect(r.text).toBe('1')
    expect(r.value).toBe('1')
    expect(r.warn).toBe('Nilai minimal 10.')
  })

  it('stops warning once the typed value reaches the minimum', () => {
    const r = applyNumberInput('15', { minValue: 10 })
    expect(r.value).toBe('15')
    expect(r.warn).toBeNull()
  })

  it('compares numerically, so "0015" satisfies min 10', () => {
    const r = applyNumberInput('0015', { minValue: 10 })
    expect(r.value).toBe('0015')
    expect(r.warn).toBeNull()
  })

  it('an empty field never warns', () => {
    expect(applyNumberInput('', { minValue: 10, maxValue: 100 }).warn).toBeNull()
  })

  it('maxValue wins when both bounds could fire', () => {
    const r = applyNumberInput('500', { minValue: 10, maxValue: 100 })
    expect(r.warn).toBe('Nilai maksimal 100.')
    expect(r.value).toBe('100')
  })
})

describe('numberInputText — what the input element shows', () => {
  it('shows the literal typed text, leading zeros and all', () => {
    expect(numberInputText('0076359761')).toBe('0076359761')
  })

  it('shows an ordinary string answer unchanged', () => {
    expect(numberInputText('42')).toBe('42')
  })

  it('still renders a number from a draft or outbox written by an older build', () => {
    expect(numberInputText(76359761)).toBe('76359761')
    expect(numberInputText(42)).toBe('42')
    expect(numberInputText(3.14)).toBe('3.14')
  })

  it('renders zero, from either shape, as "0" and not as an empty field', () => {
    expect(numberInputText(0)).toBe('0')
    expect(numberInputText('0')).toBe('0')
  })

  it('renders a cleared answer as an empty field', () => {
    expect(numberInputText(null)).toBe('')
    expect(numberInputText(undefined)).toBe('')
  })

  it('renders a shape it cannot show as an empty field', () => {
    expect(numberInputText(['a'])).toBe('')
    expect(numberInputText({ firstName: 'A' })).toBe('')
  })
})

describe('numberInputCompare — numeric view for the blur correction', () => {
  it('reads through leading zeros', () => {
    expect(numberInputCompare('0076359761')).toBe(76359761)
    expect(numberInputCompare('0015')).toBe(15)
  })

  it('reads a legacy number answer directly', () => {
    expect(numberInputCompare(76359761)).toBe(76359761)
  })

  it('reads zero as 0, from either shape — never as null', () => {
    expect(numberInputCompare('0')).toBe(0)
    expect(numberInputCompare(0)).toBe(0)
  })

  it('reads an empty or cleared answer as null', () => {
    expect(numberInputCompare('')).toBeNull()
    expect(numberInputCompare('   ')).toBeNull()
    expect(numberInputCompare(null)).toBeNull()
    expect(numberInputCompare(undefined)).toBeNull()
  })

  it('reads an unparseable answer as null rather than NaN', () => {
    expect(numberInputCompare('abc')).toBeNull()
    expect(numberInputCompare(['a'])).toBeNull()
  })
})

describe('scope guard — the bounded scales must keep sending real numbers', () => {
  // rating / nps / opinion_scale are small bounded scales feeding ordinal
  // analysis; a leading zero carries no meaning there. The server side made the
  // same call, so this file must not drift into them.
  const src = readFileSync(
    fileURLToPath(new URL('./components/QuestionInput.svelte', import.meta.url)),
    'utf8',
  ).replace(/\s+/g, ' ')

  it('leaves rating reading a number', () => {
    expect(src).toContain("const ratingValue = $derived(typeof value === 'number' ? value : 0)")
  })

  it('leaves nps reading a number', () => {
    expect(src).toContain("const npsValue = $derived(typeof value === 'number' ? value : -1)")
  })

  it('leaves opinion_scale reading a number', () => {
    expect(src).toContain("const opValue = $derived(typeof value === 'number' ? value : null)")
  })

  it('calls applyNumberInput from exactly one place', () => {
    const calls = src.match(/applyNumberInput\(/g) ?? []
    expect(calls).toHaveLength(1)
  })
})
