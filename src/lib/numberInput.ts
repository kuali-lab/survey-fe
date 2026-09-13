/**
 * Keystroke handling for the `number` question input.
 *
 * The answer is carried as the literal text the respondent typed, NOT as a
 * JS number. Numbers have no leading zeros (`Number('0076359761')` is
 * `76359761`) and JSON forbids them on numeric literals (RFC 8259), so an
 * identifier typed into a number field — a NISN, an NIK, a postal code —
 * loses its leading zeros before it ever reaches the server, silently. Keeping
 * the literal is the only place that loss can be prevented.
 *
 * Storage on the server is unaffected: it parses the string back to a float for
 * the numeric column and additionally keeps the literal it was given.
 *
 * Scoped to `number` only. rating / nps / opinion_scale are small bounded
 * scales where a leading zero carries no meaning, and they feed ordinal
 * analysis, so they keep sending real numbers.
 */

import type { AnswerValue } from './types.js'

export type NumberInputRules = {
  /** Max digit count. type=number ignores the native maxlength attribute. */
  maxLength?: number | null
  minValue?: number | null
  maxValue?: number | null
}

export type NumberInputResult = {
  /** What the input element should show (truncated / capped as needed). */
  text: string
  /** The answer to store: the literal text, or null when the field is empty. */
  value: string | null
  /** Live warning to surface, or null. */
  warn: string | null
}

export function applyNumberInput(raw: string, rules: NumberInputRules): NumberInputResult {
  let v = raw

  // Limit digit count (maxLength). type=number ignores native maxlength.
  if (rules.maxLength && v.length > rules.maxLength) {
    v = v.slice(0, rules.maxLength)
  }

  // Numeric view for range checks only — never for the stored value.
  const num = v === '' ? null : Number(v)
  let warn: string | null = null

  // Hard-cap at maxValue while typing (adding digits only increases). Warn so
  // the cap isn't silent.
  if (num !== null && !isNaN(num) && rules.maxValue != null && num > rules.maxValue) {
    v = String(rules.maxValue)
    warn = `Nilai maksimal ${rules.maxValue}.`
  } else if (num !== null && !isNaN(num) && rules.minValue != null && num < rules.minValue) {
    // Below min: do NOT clamp while typing (would block multi-digit entry like
    // "15" when min is 10). Surface a live red, shaking warning instead; the
    // value is corrected up to min on blur.
    warn = `Nilai minimal ${rules.minValue}.`
  }

  return { text: v, value: v === '' ? null : v, warn }
}

/**
 * What the number input element should display for a stored answer.
 *
 * New answers arrive as the literal typed text; drafts (localStorage + server)
 * and outbox payloads written by earlier builds still hold real numbers, and
 * those must keep rendering exactly as they did. Anything else — a cleared
 * answer, or a shape a number field cannot show — renders as an empty field.
 */
export function numberInputText(value: AnswerValue | undefined): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return ''
}

/**
 * Numeric view of a stored answer, used only for the minValue correction on
 * blur. Returns null when there is nothing to compare — including for an
 * unparseable answer, so a NaN never slips into a comparison. `0` is a real
 * answer and comes back as 0, never null.
 */
export function numberInputCompare(value: AnswerValue | undefined): number | null {
  if (typeof value === 'number') return isNaN(value) ? null : value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return isNaN(n) ? null : n
  }
  return null
}
