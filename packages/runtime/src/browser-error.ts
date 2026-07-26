import { AtlasError, errorSummary } from "@atlas/schema";

interface BrowserErrorContext {
  summary: string;
  suggestedActions: string | readonly string[];
  code: string;
}

export function createBrowserError(value: unknown, context: BrowserErrorContext): AtlasError {
  const cause = value instanceof Error ? value : new Error(String(value));
  return new AtlasError(`${context.summary}: ${errorSummary(cause.message)}`, {
    suggestedActions: context.suggestedActions,
    cause,
    code: context.code,
    surface: "browser"
  });
}

export function logBrowserError(label: string, error: AtlasError): void {
  console.error(label, {
    message: error.summary,
    suggestedActions: error.suggestedActions,
    code: error.code,
    cause: error.cause
  });
}
