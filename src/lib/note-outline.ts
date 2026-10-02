export const noteOutline = "ANAMNÉZA\n\nNÁLEZ\n\nZÁVĚR\n\nDOPORUČENÍ\n";
export function appendNoteOutline(text: string) {
  // Keep existing notes intact and make insertion idempotent.
  if (/^ANAMNÉZA\s*$/m.test(text) && /^DOPORUČENÍ\s*$/m.test(text)) return text;
  return text.trim() ? `${text.trimEnd()}\n\n${noteOutline}` : noteOutline;
}
