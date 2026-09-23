import type { DisposeRenderer } from '../widget-loader/widget-loader.types.js';
import type { RetryHostStart } from './dom-host.types.js';
import type {
  AtlasHostUi,
  AtlasHostUiOptions,
  HostUiState,
} from './host-ui.types.js';

/** Controls the single host-owned status outlet used while Atlas starts. */
export function createHostUi(options: AtlasHostUiOptions): AtlasHostUi {
  let disposeRenderer: DisposeRenderer | undefined;
  let state: HostUiState | undefined;
  let error: Error | undefined;
  let retry: RetryHostStart | undefined;

  const render = () => {
    const container = options.anchors.get('status');

    if (!container || !state) return;

    disposeRenderer?.();
    disposeRenderer = undefined;

    container.replaceChildren();
    applyHostStateToContainer(container, state);

    if (state === 'loading') {
      if (options.renderHostLoading) {
        disposeRenderer = options.renderHostLoading(container) || undefined;

        return;
      }

      renderDefaultLoading(options.document, container);

      return;
    }

    const currentError = error!;
    const currentRetry = retry!;

    if (options.renderHostError) {
      disposeRenderer =
        options.renderHostError(container, currentError, currentRetry) ||
        undefined;

      return;
    }

    renderDefaultError(options.document, container, currentRetry);
  };
  const unsubscribeAnchors = options.anchors.subscribe(render);
  const clear = () => {
    disposeRenderer?.();
    disposeRenderer = undefined;
    state = undefined;
    error = undefined;
    retry = undefined;

    const container = options.anchors.get('status');

    container?.replaceChildren();
    container?.removeAttribute('data-atlas-state');
    container?.removeAttribute('aria-busy');
  };

  return {
    showLoading() {
      clear();

      state = 'loading';

      render();
    },
    showError(nextError, nextRetry) {
      clear();

      state = 'error';
      error = nextError;
      retry = nextRetry;

      render();
    },
    clear,
    dispose() {
      clear();
      unsubscribeAnchors();
    },
  };
}

function applyHostStateToContainer(
  container: HTMLElement,
  state: HostUiState,
): void {
  container.dataset.atlasState = state;

  container.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
}

function renderDefaultLoading(
  document: Document,
  container: HTMLElement,
): void {
  const status = document.createElement('div');
  status.dataset.atlasStatus = '';

  status.setAttribute('role', 'status');

  status.textContent = 'Loading application...';

  container.replaceChildren(status);
}

function renderDefaultError(
  document: Document,
  container: HTMLElement,
  retry: RetryHostStart,
): void {
  const status = document.createElement('div');
  status.dataset.atlasStatus = '';

  status.setAttribute('role', 'alert');

  const message = document.createElement('span');
  message.textContent = 'Unable to start application. ';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Retry';

  button.addEventListener('click', retry);
  status.append(message, button);
  container.replaceChildren(status);
}
