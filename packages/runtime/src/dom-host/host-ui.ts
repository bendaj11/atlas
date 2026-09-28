import { createLoaderElement } from '../shared/loader.js';
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
  let fallbackOutlet: HTMLElement | undefined;
  let renderedContainer: HTMLElement | undefined;
  let clearOnHostAnchor = false;
  let disposed = false;

  const removeFallbackOutlet = () => {
    fallbackOutlet?.remove();
    fallbackOutlet = undefined;
  };
  const resolveContainer = () => {
    const anchor = options.anchors.get('status');

    if (anchor) {
      removeFallbackOutlet();

      return anchor;
    }

    if (!options.fallbackContainer) return undefined;

    if (!fallbackOutlet) {
      fallbackOutlet = options.document.createElement('div');
      fallbackOutlet.dataset.atlasHostStatusFallback = '';

      options.fallbackContainer.prepend(fallbackOutlet);
    }

    return fallbackOutlet;
  };
  const resetRenderedContainer = () => {
    disposeRenderer?.();
    disposeRenderer = undefined;

    renderedContainer?.replaceChildren();
    renderedContainer?.removeAttribute('data-atlas-state');
    renderedContainer?.removeAttribute('aria-busy');
    renderedContainer = undefined;
  };
  const render = () => {
    if (!state) return;

    const container = resolveContainer();

    resetRenderedContainer();

    if (!container) return;

    renderedContainer = container;

    applyHostStateToContainer(container, state);

    if (state === 'loading') {
      if (options.renderHostLoading) {
        disposeRenderer = options.renderHostLoading(container) || undefined;

        return;
      }

      container.replaceChildren(
        createLoaderElement({
          document: options.document,
          label: 'Loading application',
        }),
      );

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
  const clear = () => {
    state = undefined;
    error = undefined;
    retry = undefined;
    clearOnHostAnchor = false;

    resetRenderedContainer();
    removeFallbackOutlet();

    if (disposed) unsubscribeAnchors();
  };
  const hasHostAnchor = () =>
    Boolean(
      options.anchors.get('route-outlet') ?? options.anchors.get('status'),
    );
  const unsubscribeAnchors = options.anchors.subscribe(() => {
    if (clearOnHostAnchor && hasHostAnchor()) {
      clear();

      return;
    }

    render();
  });

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
    clearWhenHostAnchorRenders() {
      if (hasHostAnchor()) {
        clear();

        return;
      }

      clearOnHostAnchor = true;
    },
    dispose() {
      disposed = true;

      if (!clearOnHostAnchor) {
        clear();

        return;
      }

      runAfterNextRender(() => {
        if (clearOnHostAnchor) clear();
      });
    },
  };
}

function runAfterNextRender(callback: () => void): void {
  const requestFrame =
    globalThis.requestAnimationFrame ??
    ((frameCallback: () => void) => setTimeout(frameCallback, 0));

  requestFrame(() => setTimeout(callback, 0));
}

function applyHostStateToContainer(
  container: HTMLElement,
  state: HostUiState,
): void {
  container.dataset.atlasState = state;

  container.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
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
