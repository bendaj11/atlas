import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import type { requestDevelopmentSession } from '../development-session/index.js';
import type { fetchBytes, fetchJson } from '../fetch-json/index.js';
import type {
  loadHostModule,
  prefetchHostRemoteEntry,
} from '../host-loader/index.js';
import type { installModuleShim } from '../module-shim/index.js';
import type { applyOverrides } from '../overrides/index.js';
import type { loadPublishedArtifact } from '../published-artifact/index.js';
import type { validateCatalog } from '../validation/index.js';

export type LoaderDocument = Pick<
  Document,
  'createElement' | 'getElementById' | 'head'
>;

export type LogError = (message: string, failure: unknown) => void;

export interface AtlasLoaderDependencies {
  readonly document: LoaderDocument;
  readonly location?: Pick<Location, 'href'>;
  readonly fetchBytes: typeof fetchBytes;
  readonly fetchJson: typeof fetchJson;
  readonly installModuleShim: typeof installModuleShim;
  readonly loadHostModule: typeof loadHostModule;
  readonly prefetchHostRemoteEntry: typeof prefetchHostRemoteEntry;
  readonly loadPublishedArtifact: typeof loadPublishedArtifact;
  readonly requestDevelopmentSession: typeof requestDevelopmentSession;
  readonly applyOverrides: typeof applyOverrides;
  readonly validateCatalog: typeof validateCatalog;
  readonly logError: LogError;
}

export interface LoaderContext {
  runtime: AtlasHostRuntimeConfig;
  dependencies: AtlasLoaderDependencies;
}
