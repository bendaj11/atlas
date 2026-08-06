import { DOCUMENT_KEY, URL_KEY } from '../constants.js';
import type { BootstrapFailure } from '../types.js';

export function showFatalError(error: unknown): void {
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
    localStorage.removeItem(DOCUMENT_KEY);
    sessionStorage.removeItem(DOCUMENT_KEY);
    localStorage.removeItem(URL_KEY);
    location.reload();
  };

  panel.append(heading, message, actionHeading, actions, reset);
  root.append(panel);

  console.error('Atlas bootstrap could not start the product.', failure);
}

function describeFatalError(error: unknown): BootstrapFailure {
  const cause = error instanceof Error ? error : new Error(String(error));
  const detail = cause.message
    .replace(/\s+Suggested actions?:[\s\S]*$/, '')
    .trim();

  return {
    message: 'Atlas could not start this page: ' + detail,
    suggestedActions: bootstrapActions(detail),
    code: 'ATLAS_BOOTSTRAP_FAILED',
    cause,
  };
}

function bootstrapActions(message: string): string[] {
  if (/override/i.test(message))
    return [
      'Select Clear overrides and reload below.',
      'If the page then works, correct or disable the invalid override in Columbus before enabling it again.',
    ];

  if (/integrity|HTTPS|origin|assetOrigins|loopback|protocol/i.test(message)) {
    return [
      'Verify atlas.runtime.json assetOrigins and the selected host remote-entry URL.',
      'Publish the host client from an approved HTTPS origin with matching SHA-256 integrity, then reload.',
    ];
  }

  if (/host root|mount/i.test(message))
    return [
      'Verify the bootstrap page contains #atlas-host-root and the selected host client exports mount(request).',
      'Rebuild and redeploy the host bootstrap and host client, then reload.',
    ];

  if (
    /catalog|runtime|JSON|schemaVersion|host client|manifest|expose|loader API|shared dependency/i.test(
      message,
    )
  ) {
    return [
      'Verify /atlas.runtime.json and its catalogUrl return valid Atlas JSON for this host.',
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
