import {
  createElement,
  Fragment,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import type { DomHostUiRenderers } from '../dom-host/dom-host.types.js';
import type { AtlasHostComponents } from '../react.types.js';
import type {
  AtlasHostUiPortalsProps,
  AtlasHostUiStore,
  HostUiEntry,
  HostUiListener,
  ReactHostUiRenderersInput,
  ShownHostUiEntry,
} from './react-host-ui.types.js';

export function createHostUiStore(): AtlasHostUiStore {
  const listeners = new Set<HostUiListener>();
  let entries: readonly ShownHostUiEntry[] = [];
  let lastId = 0;

  const publish = (next: readonly ShownHostUiEntry[]) => {
    entries = next;

    for (const listener of listeners) listener();
  };

  return {
    show(entry) {
      lastId += 1;

      const shown = { ...entry, id: String(lastId) };

      publish([...entries, shown]);

      return () => {
        if (entries.includes(shown))
          publish(entries.filter((current) => current !== shown));
      };
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => entries,
  };
}

export function createReactHostUiRenderers(
  input: ReactHostUiRenderersInput,
): DomHostUiRenderers {
  const { store, components } = input;
  const renderers: DomHostUiRenderers = {};

  if (components.loading)
    renderers.renderLoading = (element) =>
      store.show({ kind: 'loading', element });

  if (components.error)
    renderers.renderError = (element, event, retry) =>
      store.show({
        kind: 'error',
        element,
        props: { error: event.error, retry },
      });

  if (components.widgetLoading)
    renderers.renderWidgetLoading = (element) =>
      store.show({ kind: 'widgetLoading', element });

  if (components.widgetError)
    renderers.renderWidgetError = (element, context, retry) =>
      store.show({
        kind: 'widgetError',
        element,
        props: { error: context.error, retry },
      });

  if (components.hostError)
    renderers.renderHostError = (element, error, retry) =>
      store.show({ kind: 'hostError', element, props: { error, retry } });

  return renderers;
}

export function AtlasHostUiPortals(
  props: AtlasHostUiPortalsProps,
): ReactElement {
  const { store, components } = props;
  const entries = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  return createElement(
    Fragment,
    null,
    entries.map((entry) =>
      createPortal(
        createEntryElement(entry, components),
        entry.element,
        entry.id,
      ),
    ),
  );
}

function createEntryElement(
  entry: HostUiEntry,
  components: AtlasHostComponents,
): ReactElement | null {
  if ('props' in entry) {
    const Component = components[entry.kind];

    return Component ? createElement(Component, entry.props) : null;
  }

  const Component = components[entry.kind];

  return Component ? createElement(Component) : null;
}
