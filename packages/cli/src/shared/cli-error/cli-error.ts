import { AtlasError, errorSummary } from '@atlas/schema';
import { COMMAND_ALIASES } from '../arguments/arguments.js';
import { httpStatusOf } from '../errors/errors.js';

export function cliError(
  summary: string,
  suggestedActions: string | readonly string[],
  options: { code?: string; cause?: unknown } = {},
): AtlasError {
  return new AtlasError(summary, {
    suggestedActions,
    surface: 'cli',
    ...(options.code ? { code: options.code } : {}),
    ...(options.cause !== undefined ? { cause: options.cause } : {}),
  });
}

export function createCliError(
  command: string | undefined,
  value: unknown,
): AtlasError {
  if (value instanceof AtlasError && value.surface === 'cli') return value;

  if (value instanceof AtlasError && value.surface === 'universal') {
    return new AtlasError(value.summary, {
      suggestedActions: value.suggestedActions,
      cause: value.cause,
      ...(value.code ? { code: value.code } : {}),
      surface: 'cli',
    });
  }
  const normalizedCommand = command
    ? (COMMAND_ALIASES[command] ?? command)
    : undefined;
  const cause = value instanceof Error ? value : new Error(String(value));
  const sourceSummary = errorSummary(cause.message);

  return new AtlasError(cliSummary(normalizedCommand, sourceSummary), {
    suggestedActions: cliActions(normalizedCommand, sourceSummary),
    cause,
    code: 'ATLAS_CLI_FAILURE',
    surface: 'cli',
  });
}

export function formatErrorWithCauses(error: Error): string {
  const causes = errorCauses(error);
  if (causes.length === 0) return error.message;

  return `${error.message}\nCaused by: ${causes.join('\nCaused by: ')}`;
}

function errorCauses(error: Error): readonly string[] {
  const messages: string[] = [];
  const seen = new Set<unknown>([error]);
  let cause = error.cause;

  while (cause !== undefined && !seen.has(cause)) {
    seen.add(cause);
    messages.push(errorCauseMessage(cause));
    cause = cause instanceof Error ? cause.cause : undefined;
  }

  return messages;
}

function errorCauseMessage(cause: unknown): string {
  if (cause instanceof Error) {
    const status = httpStatusOf(cause);

    return `${cause.name}: ${cause.message}${status ? ` (HTTP ${status})` : ''}`;
  }

  return String(cause);
}

function cliSummary(command: string | undefined, summary: string): string {
  if (
    /^(Atlas\b|--|ATLAS_|Unknown help topic|Unknown or incomplete command)/i.test(
      summary,
    )
  ) {
    return summary;
  }

  return command
    ? `Atlas ${command} failed: ${summary}`
    : `Atlas CLI failed: ${summary}`;
}

function cliActions(
  command: string | undefined,
  message: string,
): readonly string[] {
  if (/Unknown (?:help topic|or incomplete command)/i.test(message)) {
    return [
      'Run `atlas --help` to choose a supported command, then retry with the documented arguments.',
    ];
  }

  if (/EACCES|EPERM|permission denied|not writable/i.test(message)) {
    return [
      'Give the current user read and write access to the named path.',
      rerunAction(command),
    ];
  }

  if (
    /ENOENT|not found|Could not find|missing required configuration file/i.test(
      message,
    )
  ) {
    return [
      'Restore the named file or pass an existing Atlas project or path.',
      rerunAction(command),
    ];
  }

  if (/CORS|fetch|network|HTTP \d|timed out|could not query/i.test(message)) {
    return [
      'Verify the named URL is reachable with the required credentials and CORS policy.',
      rerunAction(command),
    ];
  }

  if (/storage|S3|bucket|registry|deployment lock|lease/i.test(message)) {
    return [
      'Correct the named storage, registry, credentials, or deployment-lock condition.',
      rerunAction(command),
    ];
  }

  if (
    /tsconfig|TypeScript|atlas\.config|compil|schema|manifest|configuration/i.test(
      message,
    )
  ) {
    return [
      'Correct the named configuration or TypeScript diagnostic.',
      rerunAction(command),
    ];
  }

  if (
    /requires? --|Pass --|must be|is required|Unsupported|Unknown option/i.test(
      message,
    )
  ) {
    return [
      'Correct the named command option or value.',
      command
        ? `Run \`atlas ${command} --help\` for accepted arguments and examples.`
        : 'Run `atlas --help` for accepted commands and options.',
    ];
  }

  switch (command) {
    case 'generate':
      return [
        'Correct the named workspace, framework, project path, or generation option, then rerun `atlas generate`.',
      ];
    case 'dev':
      return [
        'Correct the named project, host URL, port, or local build failure, then rerun `atlas dev`.',
      ];
    case 'bootstrap':
    case 'compile-config':
      return [
        `Correct the named configuration or build failure, then rerun \`atlas ${command}\`.`,
      ];
    case 'publish':
    case 'deploy':
    case 'remove-preview':
    case 'prune-previews':
      return [
        `Correct the named publication, storage, registry, or CI condition, then rerun \`atlas ${command}\`.`,
      ];
    case 'verify':
      return [
        'Correct each failed deployment URL, response header, or artifact, deploy the fix, then rerun `atlas verify`.',
      ];
    default:
      return [
        'Correct the reported input or workspace condition, then rerun the Atlas command.',
      ];
  }
}

function rerunAction(command: string | undefined): string {
  return command
    ? `Rerun \`atlas ${command}\` after correcting the condition.`
    : 'Rerun the Atlas command after correcting the condition.';
}
