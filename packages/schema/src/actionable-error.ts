const ACTION_LABEL = 'Suggested action:';
const ACTIONS_LABEL = 'Suggested actions:';
const ACTION_SECTION = /\s+Suggested actions?:[\s\S]*$/u;

export type AtlasErrorSurface = 'universal' | 'cli' | 'browser';

export interface AtlasErrorOptions {
  suggestedActions: string | readonly string[];
  cause?: unknown;
  code?: string;
  surface?: AtlasErrorSurface;
}

/** Public Atlas failure with a user-facing summary, recovery steps, and preserved cause. */
export class AtlasError extends Error {
  readonly summary: string;
  readonly suggestedActions: readonly string[];
  readonly code: string | undefined;
  readonly surface: AtlasErrorSurface;

  constructor(summary: string, options: AtlasErrorOptions) {
    const actions = normalizeActions(options.suggestedActions);
    const normalizedSummary = errorSummary(summary);
    super(actionableMessage(normalizedSummary, actions), {
      cause: options.cause,
    });
    this.name = 'AtlasError';
    this.summary = normalizedSummary;
    this.suggestedActions = actions;
    this.code = options.code;
    this.surface = options.surface ?? 'universal';
  }
}

export function actionableMessage(
  message: string,
  suggestedActions: string | readonly string[],
): string {
  const summary = errorSummary(message);
  const actions = normalizeActions(suggestedActions);
  if (actions.length === 1) return `${summary} ${ACTION_LABEL} ${actions[0]}`;
  return `${summary} ${ACTIONS_LABEL} ${actions.map((action, index) => `${index + 1}) ${action}`).join(' ')}`;
}

export function ensureActionableError(
  value: unknown,
  options?: string | AtlasErrorOptions,
): AtlasError {
  if (value instanceof AtlasError && options === undefined) return value;
  const cause = value instanceof Error ? value : new Error(String(value));
  const normalizedOptions =
    typeof options === 'string' ? { suggestedActions: options } : options;
  return new AtlasError(errorSummary(cause.message), {
    suggestedActions:
      normalizedOptions?.suggestedActions ?? suggestedActionFor(cause.message),
    cause: normalizedOptions?.cause ?? cause,
    ...(normalizedOptions?.code ? { code: normalizedOptions.code } : {}),
    ...(normalizedOptions?.surface
      ? { surface: normalizedOptions.surface }
      : {}),
  });
}

export function errorSummary(message: string): string {
  return message.replace(ACTION_SECTION, '').trim();
}

export function suggestedActionFor(message: string): string {
  const summary = errorSummary(message);
  const duplicateApp = /Duplicate app id "([^"]+)"/i.exec(summary)?.[1];
  if (duplicateApp)
    return `Remove duplicate manifest entries for "${duplicateApp}" from the host catalog, then retry.`;
  if (
    /missing required configuration file ".*atlas\.config\.ts"/i.test(summary)
  ) {
    return 'Restore or create atlas.config.ts in the named project, then retry the failed operation.';
  }
  if (/catalog/i.test(summary)) {
    return 'Verify the catalog URL is reachable and its JSON matches the Atlas catalog schema, then retry.';
  }
  if (/CORS|fetch|network|remote entry|asset|resource/i.test(summary)) {
    return 'Verify the named URL is reachable, permits the host origin through CORS, and serves the expected Atlas artifact, then retry.';
  }
  if (
    /config|schema|manifest|invalid|expects|required|must|unsupported/i.test(
      summary,
    )
  ) {
    return 'Correct the named value in Atlas configuration or generated JSON, then retry the failed operation.';
  }
  if (/widget|mount|overlay|popup/i.test(summary)) {
    return 'Verify the named capability is configured and exported by the selected app build, then retry.';
  }
  return 'Correct the reported condition, then retry. If it persists, inspect the preserved cause and stack trace.';
}

function normalizeActions(
  actions: string | readonly string[],
): readonly string[] {
  const normalized = (typeof actions === 'string' ? [actions] : actions)
    .map((action) => action.trim())
    .filter(Boolean);
  return normalized.length > 0
    ? normalized
    : ['Correct the reported condition, then retry.'];
}
