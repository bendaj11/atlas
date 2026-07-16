const ACTION_LABEL = "Suggested action:";

export function actionableMessage(message: string, suggestedAction: string): string {
  if (message.includes(ACTION_LABEL)) return message;
  return `${message} ${ACTION_LABEL} ${suggestedAction}`;
}

export function ensureActionableError(value: unknown, fallbackAction?: string): Error {
  const error = value instanceof Error ? value : new Error(String(value));
  error.message = actionableMessage(error.message, suggestedActionFor(error.message, fallbackAction));
  return error;
}

export function suggestedActionFor(message: string, fallbackAction?: string): string {
  const duplicateApp = /Duplicate app id "([^"]+)"/.exec(message)?.[1];
  if (duplicateApp) return `Remove duplicate manifest entries for "${duplicateApp}" from the host catalog, then retry.`;
  if (/missing required configuration file ".*atlas\.config\.ts"/i.test(message)) {
    return "Restore or create atlas.config.ts in the named project, then rerun the same Atlas command.";
  }
  if (/catalog/i.test(message)) return "Verify configured catalog URL is reachable and catalog JSON matches Atlas schema, then retry.";
  if (/CORS|fetch|network|remote entry|asset|resource/i.test(message)) {
    return "Verify referenced URL is reachable, permits host-origin CORS, and serves expected Atlas artifact, then retry.";
  }
  if (/config|schema|manifest|invalid|expects|required|must|unsupported/i.test(message)) {
    return "Correct named value in Atlas configuration or generated JSON, then rerun command or reload host.";
  }
  if (/widget|mount|overlay|popup/i.test(message)) {
    return "Verify named capability is configured and exported by selected app build, then retry.";
  }
  return fallbackAction ?? "Fix reported condition, then retry same operation; if it repeats, keep full error and stack trace for diagnosis.";
}
