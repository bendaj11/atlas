import type { AtlasHostRuntimeConfig } from '@atlas/schema';
import type { fetchBytes, fetchJson } from '../fetch-json/index.js';
import type { loadHostModule } from '../host-loader/index.js';
import type { installModuleShim } from '../module-shim/index.js';
import type { applyOverrides } from '../overrides/index.js';
import type { loadPublishedArtifact } from '../published-artifact/index.js';
import type { validateCatalog } from '../validation/index.js';

export interface AtlasLoaderDependencies {
  readonly document: Pick<
    Document,
    'createElement' | 'getElementById' | 'head'
  >;
  readonly location?: Pick<Location, 'href'>;
  readonly fetchBytes: typeof fetchBytes;
  readonly fetchJson: typeof fetchJson;
  readonly installModuleShim: typeof installModuleShim;
  readonly loadHostModule: typeof loadHostModule;
  readonly loadPublishedArtifact: typeof loadPublishedArtifact;
  readonly applyOverrides: typeof applyOverrides;
  readonly validateCatalog: typeof validateCatalog;
}

export interface LoaderContext {
  runtime: AtlasHostRuntimeConfig;
  dependencies: AtlasLoaderDependencies;
}
