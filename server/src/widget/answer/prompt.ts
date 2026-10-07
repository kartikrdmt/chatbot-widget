import {
  WIDGET_DEFAULT_COMPANY_PROMPT,
  WIDGET_PLATFORM_RULES,
} from '../widget.constants.js';

export function buildSystemPrompt(
  companyPrompt: string | undefined,
  reference = '',
): string {
  const parts = [
    WIDGET_PLATFORM_RULES,
    `Company instructions: ${companyPrompt?.trim() || WIDGET_DEFAULT_COMPANY_PROMPT}`,
  ];
  if (reference.trim()) {
    // Stops a page from closing the <reference> block early.
    const safe = reference.replaceAll(/<\/?reference>/gi, '');
    parts.push(`<reference>\n${safe}\n</reference>`);
  }
  return parts.join('\n\n');
}
