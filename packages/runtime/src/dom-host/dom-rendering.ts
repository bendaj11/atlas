import { createLoaderElement } from '../shared/loader.js';
import type { AtlasHostMountEvent } from '../host-runtime/host-runtime.types.js';
import type { DisposeRenderer } from '../widget-loader/widget-loader.types.js';
import type {
  AtlasHostMountErrorEvent,
  DomHostUiRenderers,
  HostMountStateRendererInput,
  HostNavigationRenderInput,
  RenderHostMountState,
  RetryPlacementMount,
} from './dom-host.types.js';

export function renderHostNavigation(input: HostNavigationRenderInput): void {
  const { document, nav, items } = input;

  if (!nav) return;

  nav.replaceChildren(
    ...items.map((item) => {
      const link = document.createElement('a');
      link.href = item.href;
      link.textContent = item.label;

      if (item.active) link.setAttribute('aria-current', 'page');

      link.addEventListener('click', (event) => {
        event.preventDefault();
        item.navigate();
      });

      return link;
    }),
  );
}

export function createHostMountStateRenderer(
  input: HostMountStateRendererInput,
): RenderHostMountState {
  const { document, ui } = input;
  const statuses = new WeakMap<HTMLElement, DisposeRenderer>();

  return (event, retry) => {
    const { container, state } = event;
    container.dataset.atlasState = state;
    container.dataset.atlasAppId = event.manifest.id;
    container.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');

    statuses.get(container)?.();
    statuses.delete(container);

    const disposeStatus = renderPlacementStatus({
      document,
      ui,
      event,
      retry,
    });

    if (disposeStatus) statuses.set(container, disposeStatus);

    if (state === 'unmounted') {
      container.replaceChildren();

      delete container.dataset.atlasAppId;
    }
  };
}

function renderPlacementStatus(input: {
  document: Document;
  ui: DomHostUiRenderers;
  event: AtlasHostMountEvent;
  retry: RetryPlacementMount;
}): DisposeRenderer | undefined {
  const { document, ui, event, retry } = input;

  if (event.state === 'loading') {
    const status = createPlacementStatus(document, event.container);

    if (ui.renderLoading)
      return removeStatusAfter(status, ui.renderLoading(status, event));

    status.append(
      createLoaderElement({
        document,
        label: `Loading ${event.manifest.name}`,
        compact: event.placement.kind === 'slot',
      }),
    );

    return removeStatusAfter(status);
  }

  if (!isMountErrorEvent(event)) return undefined;

  const status = createPlacementStatus(document, event.container);
  let retried = false;
  const retryOnce = () => {
    if (retried) return;

    retried = true;
    retry();
  };

  if (ui.renderError)
    return removeStatusAfter(status, ui.renderError(status, event, retryOnce));

  status.append(
    createPlacementAlert({ document, name: event.manifest.name, retryOnce }),
  );

  return removeStatusAfter(status);
}

function isMountErrorEvent(
  event: AtlasHostMountEvent,
): event is AtlasHostMountErrorEvent {
  return event.state === 'error' && event.error !== undefined;
}

function createPlacementStatus(
  document: Document,
  container: HTMLElement,
): HTMLElement {
  const status = document.createElement('div');
  status.dataset.atlasPlacementStatus = '';
  status.style.display = 'contents';

  container.prepend(status);

  return status;
}

function removeStatusAfter(
  status: HTMLElement,
  dispose?: DisposeRenderer,
): DisposeRenderer {
  return () => {
    dispose?.();
    status.remove();
  };
}

function createPlacementAlert(input: {
  document: Document;
  name: string;
  retryOnce: RetryPlacementMount;
}): HTMLElement {
  const { document, name, retryOnce } = input;
  const alert = document.createElement('div');
  alert.dataset.atlasStatus = '';

  alert.setAttribute('role', 'alert');

  const message = document.createElement('span');
  message.textContent = `Unable to load ${name}. `;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Retry';

  button.addEventListener('click', retryOnce);
  alert.append(message, button);

  return alert;
}
