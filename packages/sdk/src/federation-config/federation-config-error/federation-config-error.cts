export interface FederationConfigErrorOptions {
  readonly suggestedActions: string | readonly string[];
  readonly code: string;
  readonly cause?: unknown;
}

/** Build-time Atlas failure. Mirrors `AtlasError` message shape without loading the ESM-only schema package from CommonJS. */
export class FederationConfigError extends Error {
  readonly summary: string;
  readonly suggestedActions: readonly string[];
  readonly code: string;
  readonly surface = 'cli' as const;

  constructor(summary: string, options: FederationConfigErrorOptions) {
    const actions =
      typeof options.suggestedActions === 'string'
        ? [options.suggestedActions]
        : [...options.suggestedActions];
    super(formatActionableMessage(summary, actions), { cause: options.cause });
    this.name = 'AtlasError';
    this.summary = summary;
    this.suggestedActions = actions;
    this.code = options.code;
  }
}

function formatActionableMessage(
  summary: string,
  actions: readonly string[],
): string {
  if (actions.length === 1) return `${summary} Suggested action: ${actions[0]}`;
  const numbered = actions.map((action, index) => `${index + 1}) ${action}`);

  return `${summary} Suggested actions: ${numbered.join(' ')}`;
}
