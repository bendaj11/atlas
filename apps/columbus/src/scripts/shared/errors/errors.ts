export function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function failureMessage(
  error: unknown,
  operation = 'complete the requested action',
  suggestedAction = 'Reload the Atlas host page, reopen Columbus, and retry.',
): string {
  const detail = messageFromError(error)
    .replace(/\s+Suggested actions?:[\s\S]*$/u, '')
    .trim();

  return `Columbus could not ${operation}: ${detail} Suggested action: ${suggestedAction}`;
}
