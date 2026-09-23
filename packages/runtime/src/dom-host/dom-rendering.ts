import type { AtlasHostMountEvent } from '../host-runtime/host-runtime.types.js';
import type {
  HostMountStateRenderInput,
  HostNavigationRenderInput,
  MountStateRenderingOptions,
  RetryPlacementMount,
} from './dom-host.types.js';

type PlacementStatusRole = 'status' | 'alert';

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

export function renderHostMountState(input: HostMountStateRenderInput): void {
  const { document, event, retry, options } = input;
  const container = event.container;
  container.dataset.atlasState = event.state;
  container.dataset.atlasAppId = event.manifest.id;
  container.setAttribute(
    'aria-busy',
    event.state === 'loading' ? 'true' : 'false',
  );

  const existingStatus = container.querySelector<HTMLElement>(
    ':scope > [data-atlas-placement-status]',
  );

  if (event.state === 'mounting' || event.state === 'mounted')
    existingStatus?.remove();

  if (event.state === 'loading')
    renderPlacementLoadingState({ document, event, existingStatus, options });

  if (event.state === 'error')
    renderPlacementErrorState({
      document,
      event,
      retry,
      existingStatus,
      options,
    });

  if (event.state === 'unmounted') {
    container.replaceChildren();

    delete container.dataset.atlasAppId;
  }
}

function renderPlacementLoadingState(input: {
  document: Document;
  event: AtlasHostMountEvent;
  existingStatus: HTMLElement | null;
  options: MountStateRenderingOptions;
}): void {
  const { document, event, existingStatus, options } = input;

  if (options.renderLoading) {
    options.renderLoading(event.container, event);

    return;
  }

  const status = findOrCreatePlacementStatusElement({
    document,
    container: event.container,
    existingStatus,
    role: 'status',
  });
  const label = document.createElement('span');
  label.textContent = `Loading ${event.manifest.name}...`;

  status.append(label);
}

function renderPlacementErrorState(input: {
  document: Document;
  event: AtlasHostMountEvent;
  retry: RetryPlacementMount;
  existingStatus: HTMLElement | null;
  options: MountStateRenderingOptions;
}): void {
  const { document, event, retry, existingStatus, options } = input;

  if (options.renderError) {
    options.renderError(event.container, event, retry);

    return;
  }

  const status = findOrCreatePlacementStatusElement({
    document,
    container: event.container,
    existingStatus,
    role: 'alert',
  });
  const message = document.createElement('span');
  message.textContent = `Unable to load ${event.manifest.name}. `;

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Retry';

  button.addEventListener('click', retry);
  status.append(message, button);
}

function findOrCreatePlacementStatusElement(input: {
  document: Document;
  container: HTMLElement;
  existingStatus: HTMLElement | null;
  role: PlacementStatusRole;
}): HTMLElement {
  const { document, container, existingStatus, role } = input;
  const status = existingStatus ?? document.createElement('div');
  status.dataset.atlasStatus = '';
  status.dataset.atlasPlacementStatus = '';

  status.setAttribute('role', role);
  status.replaceChildren();

  if (!existingStatus) container.prepend(status);

  return status;
}
