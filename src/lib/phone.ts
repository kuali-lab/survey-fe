// Shared phone-number helpers for the 'phone' question type and the phone
// sub-field of 'contact_info'. Digits only — no '+' or separators — matching
// how phone numbers are stored/displayed elsewhere in the app (e.g. "08...").

const DIGITS_ONLY_RE = /^\d+$/

export function sanitizePhoneInput(raw: string): string {
  return raw.replace(/\D/g, '')
}

export function isValidPhoneFormat(raw: string): boolean {
  const trimmed = raw.trim()
  if (!DIGITS_ONLY_RE.test(trimmed)) return false
  return trimmed.length >= 7 && trimmed.length <= 15
}
