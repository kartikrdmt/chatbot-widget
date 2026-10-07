import {
  WIDGET_DEFAULT_COMPANY_PROMPT,
  WIDGET_PLATFORM_RULES,
} from '../widget.constants.js';

/**
 * The order matters: fixed platform rules, then the customer's own instructions, then any retrieved
 * reference text clearly marked as untrusted data.
 */
export function buildSystemPrompt(
  companyPrompt: string | undefined,
  reference = '',
): string {
  const parts = [
    WIDGET_PLATFORM_RULES,
    `Company instructions: ${companyPrompt?.trim() || WIDGET_DEFAULT_COMPANY_PROMPT}`,
  ];
  if (reference.trim()) {
    // A page could contain a literal "</reference>"; neutralise it so it cannot close the block early.
    const safe = reference.replaceAll(/<\/?reference>/gi, '');
    parts.push(`<reference>\n${safe}\n</reference>`);
  }
  return parts.join('\n\n');
}
