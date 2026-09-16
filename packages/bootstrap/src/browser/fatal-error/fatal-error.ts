import { AtlasError, errorSummary } from '@atlas/schema';
import { OVERRIDES_STORAGE_KEY } from '../overrides/overrides.js';

export interface BootstrapFailure {
  message: string;
  suggestedActions: string[];
  code: string;
  cause: Error;
}

export interface FatalErrorDependencies {
  readonly document: Pick<
    Document,
    'getElementById' | 'createElement' | 'body'
  >;
  readonly sessionStorage: Pick<Storage, 'removeItem'>;
  readonly localStorage: Pick<Storage, 'removeItem'>;
  readonly reloadPage: () => void;
  readonly logError: (message: string, failure: BootstrapFailure) => void;
}

export function showFatalError({
  error,
  dependencies = defaultDependencies(),
}: {
  error: unknown;
  dependencies?: FatalErrorDependencies;
}): void {
  const { document } = dependencies;
  const failure = describeFatalError(error);
  const root = document.getElementById('atlas-host-root') || document.body;

  root.replaceChildren();

  const panel = document.createElement('main');
  panel.setAttribute('role', 'alert');

  const heading = document.createElement('h1');
  heading.textContent = 'Product failed to start';

  const message = document.createElement('p');
  message.textContent = failure.message;

  const actionHeading = document.createElement('strong');
  actionHeading.textContent =
    failure.suggestedActions.length === 1
      ? 'Suggested action'
      : 'Suggested actions';

  const actions = document.createElement('ol');
  for (const action of failure.suggestedActions) {
    const item = document.createElement('li');
    item.textContent = action;
    actions.append(item);
  }

  const reset = document.createElement('button');
  reset.textContent = 'Clear overrides and reload';
  reset.onclick = () => {
    dependencies.localStorage.removeItem(OVERRIDES_STORAGE_KEY);
    dependencies.sessionStorage.removeItem(OVERRIDES_STORAGE_KEY);
    dependencies.reloadPage();
  };

  panel.append(heading, message, actionHeading, actions, reset);
  root.append(panel);

  dependencies.logError(
    'Atlas bootstrap could not start the product.',
    failure,
  );
}

function defaultDependencies(): FatalErrorDependencies {
  return {
    document,
    sessionStorage,
    localStorage,
    reloadPage: () => location.reload(),
    logError: (message, failure) => console.error(message, failure),
  };
}

function describeFatalError(error: unknown): BootstrapFailure {
  if (error instanceof AtlasError) {
    return {
      message: 'Atlas could not start this page: ' + error.summary,
      suggestedActions: [...error.suggestedActions],
      code: error.code ?? 'ATLAS_BOOTSTRAP_FAILED',
      cause: error,
    };
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const detail = errorSummary(cause.message);

  return {
    message: 'Atlas could not start this page: ' + detail,
    suggestedActions: suggestedActionsFor(detail),
    code: 'ATLAS_BOOTSTRAP_FAILED',
    cause,
  };
}

function suggestedActionsFor(message: string): string[] {
  if (/override/i.test(message))
    return [
      'Select Clear overrides and reload below.',
      'If the page then works, correct or disable the invalid override in Columbus before enabling it again.',
    ];

  if (/integrity|HTTPS|origin|assetOrigins|loopback|protocol/i.test(message)) {
    return [
      'Verify atlas.runtime.json registry origins and the selected host remote-entry URL.',
      'Publish the host client from an approved HTTPS origin with matching SHA-256 integrity, then reload.',
    ];
  }

  if (/host root|mount/i.test(message))
    return [
      'Verify the bootstrap page contains #atlas-host-root and the selected host client exports mount(request).',
      'Rebuild and redeploy the host bootstrap and host client, then reload.',
    ];

  if (
    /catalog|bootstrap|discovery|runtime|JSON|schemaVersion|host client|manifest|expose|loader API|shared dependency/i.test(
      message,
    )
  ) {
    return [
      'Verify /atlas.runtime.json and the selected environment manifest return valid Atlas JSON.',
      'Publish a host client compatible with this Atlas loader, then reload.',
    ];
  }

  if (/fetch|HTTP|network|timed out|abort/i.test(message)) {
    return [
      'Open the failed URL from the error details and verify it is reachable.',
      'Correct the deployment, authentication, or CORS policy, then reload.',
    ];
  }

  return [
    'Inspect the preserved cause in the browser console for the first failing URL or configuration value.',
    'Correct the deployed host configuration or artifact, then reload.',
  ];
}
