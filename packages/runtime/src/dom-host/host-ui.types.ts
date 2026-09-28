import type { AtlasHostAnchorRegistry } from './host-anchors.js';
import type { RenderHostError, RetryHostStart } from './dom-host.types.js';

export interface AtlasHostUiOptions {
  document: Document;
  anchors: AtlasHostAnchorRegistry;
  fallbackContainer?: HTMLElement;
  renderHostError?: RenderHostError;
}

export interface AtlasHostUi {
  showError(error: Error, retry: RetryHostStart): void;
  clear(): void;
}
