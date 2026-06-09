/**
 * Strip HTML tags for plain-text display.
 *
 * Question titles/descriptions are authored in the dashboard's RichTextEditor and
 * stored as rich HTML. The respondent app renders them with `{@html}` where
 * formatted display is intended (QuestionCard, welcome/closing/section). Anywhere
 * a title is shown as a plain label instead (e.g. the surveyor recap list), use
 * this so the raw tags don't appear as literal text.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html.replace(/<[^>]*>?/gm, '')
}
