import type { DisposeRenderer } from '../widget-loader/widget-loader.types.js';
import type { RetryHostStart } from './dom-host.types.js';
import type { AtlasHostUi, AtlasHostUiOptions } from './host-ui.types.js';

export function createHostUi(options: AtlasHostUiOptions): AtlasHostUi {
  let status: HTMLElement | undefined;
  let disposeRenderer: DisposeRenderer | undefined;
  let unsubscribeAnchors: (() => void) | undefined;

  const place = (element: HTMLElement) => {
    const parent = options.anchors.get('status') ?? options.fallbackContainer;

    if (element.parentElement === parent) return;

    if (parent) parent.prepend(element);
    else element.remove();
  };
  const clear = () => {
    disposeRenderer?.();
    unsubscribeAnchors?.();
    status?.remove();

    disposeRenderer = undefined;
    unsubscribeAnchors = undefined;
    status = undefined;
  };

  return {
    showError(error, retry) {
      clear();

      const element = options.document.createElement('div');
      element.dataset.atlasHostStatus = '';
      element.dataset.atlasState = 'error';

      place(element);

      status = element;
      unsubscribeAnchors = options.anchors.subscribe(() => place(element));

      if (options.renderHostError)
        disposeRenderer = options.renderHostError(element, error, retry);
      else renderDefaultError(options.document, element, retry);
    },
    clear,
  };
}

function renderDefaultError(
  document: Document,
  container: HTMLElement,
  retry: RetryHostStart,
): void {
  const alert = document.createElement('div');
  alert.dataset.atlasStatus = '';

  alert.setAttribute('role', 'alert');

  const message = document.createElement('span');
  message.textContent = 'Unable to start application. ';

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Retry';

  button.addEventListener('click', retry);
  alert.append(message, button);
  container.append(alert);
}
