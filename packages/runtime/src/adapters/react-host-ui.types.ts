import type { AtlasErrorProps, AtlasHostComponents } from '../react.types.js';

export type HostUiLoadingKind = 'loading' | 'widgetLoading';

export type HostUiErrorKind = 'error' | 'widgetError' | 'hostError';

export interface HostUiLoadingEntry {
  kind: HostUiLoadingKind;
  element: HTMLElement;
}

export interface HostUiErrorEntry {
  kind: HostUiErrorKind;
  element: HTMLElement;
  props: AtlasErrorProps;
}

export type HostUiEntry = HostUiLoadingEntry | HostUiErrorEntry;

export type ShownHostUiEntry = HostUiEntry & { id: string };

export type HideHostUiEntry = () => void;

export type HostUiListener = () => void;

export interface AtlasHostUiStore {
  show: (entry: HostUiEntry) => HideHostUiEntry;
  subscribe: (listener: HostUiListener) => () => void;
  getSnapshot: () => readonly ShownHostUiEntry[];
}

export interface ReactHostUiRenderersInput {
  store: AtlasHostUiStore;
  components: AtlasHostComponents;
}

export interface AtlasHostUiPortalsProps {
  store: AtlasHostUiStore;
  components: AtlasHostComponents;
}
