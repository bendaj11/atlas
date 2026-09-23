import type { AtlasHostAnchorRegistry } from './host-anchors.js';
import type {
  RenderHostError,
  RenderHostLoading,
  RetryHostStart,
} from './dom-host.types.js';

export interface AtlasHostUiOptions {
  document: Document;
  anchors: AtlasHostAnchorRegistry;
  renderHostLoading?: RenderHostLoading;
  renderHostError?: RenderHostError;
}

export interface AtlasHostUi {
  showLoading(): void;
  showError(error: Error, retry: RetryHostStart): void;
  clear(): void;
  dispose(): void;
}

export type HostUiState = 'loading' | 'error';
