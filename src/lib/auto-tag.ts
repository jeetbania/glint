/** Free, offline, "good enough" categorization: a handful of keyword
 * rules over whatever text OCR (lib/ocr.ts) pulled out of a screenshot.
 * Not real understanding — a receipt gets tagged "receipt" because it
 * has a currency symbol and the word "total" near it, not because
 * anything actually read the image. See lib/ai/categorize.ts for the
 * opt-in, bring-your-own-key path that does real visual understanding.
 */
const RULES: { tag: string; pattern: RegExp }[] = [
  { tag: "receipt", pattern: /\b(total|subtotal|tax|receipt|invoice)\b/i },
  { tag: "code", pattern: /\b(function|const |let |import |class |def |return )\b|[{};]\s*$/im },
  { tag: "error", pattern: /\b(error|exception|failed|stack trace|traceback)\b/i },
  { tag: "chat", pattern: /\b(sent|delivered|read \d{1,2}:\d{2}|typing\.\.\.)\b/i },
  { tag: "email", pattern: /\b(inbox|subject:|from:|sent from my)\b/i },
  { tag: "calendar", pattern: /\b(am|pm)\b.{0,20}\b(mon|tue|wed|thu|fri|sat|sun)\b/i },
  { tag: "flight", pattern: /\b(boarding pass|gate|departure|flight [a-z0-9]{2,6})\b/i },
  { tag: "recipe", pattern: /\b(ingredients?|tbsp|tsp|preheat|cup of)\b/i },
];

/** Given whatever text OCR found, suggest up to a few tag names. Empty
 * input (no text found, or OCR disabled/failed) suggests nothing. */
export function suggestTagsFromText(text: string): string[] {
  if (!text.trim()) return [];
  const matches = RULES.filter((r) => r.pattern.test(text)).map((r) => r.tag);
  return [...new Set(matches)].slice(0, 3);
}
