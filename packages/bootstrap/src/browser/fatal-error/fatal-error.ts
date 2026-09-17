import { HOST_ROOT_ELEMENT_ID } from '../atlas-loader/atlas-loader.constants.js';
import { OVERRIDES_STORAGE_KEY } from '../overrides/index.js';
import { describeFatalError } from './describe-fatal-error/describe-fatal-error.js';
import type { FatalErrorDependencies } from './fatal-error.types.js';

export function showFatalError({
  error,
  dependencies = browserFatalErrorDependencies(),
}: {
  error: unknown;
  dependencies?: FatalErrorDependencies;
}): void {
  const { document } = dependencies;
  const failure = describeFatalError(error);
  const root = document.getElementById(HOST_ROOT_ELEMENT_ID) || document.body;

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

function browserFatalErrorDependencies(): FatalErrorDependencies {
  return {
    document,
    sessionStorage,
    localStorage,
    reloadPage: () => location.reload(),
    logError: (message, failure) => console.error(message, failure),
  };
}
