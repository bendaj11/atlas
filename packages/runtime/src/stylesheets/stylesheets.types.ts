import type { AtlasRemoteTrustPolicy } from '../loader/trust/trust-policy.types.js';

export type AtlasStyleRelease = () => void;

/** Defines where a remote's declared styles are installed. */
export interface AtlasStylesheetLoadOptions {
  readonly policy?: AtlasRemoteTrustPolicy;
  readonly target?: ParentNode;
}

export interface LoadedStylesheet {
  element: HTMLLinkElement;
  ready: Promise<void>;
  references: number;
}
