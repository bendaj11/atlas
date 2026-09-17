import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { RUNTIME_SNAPSHOT_ELEMENT_ID } from './atlas-loader.constants.js';
import type { AtlasLoaderDependencies } from './atlas-loader.types.js';

export function publishRuntimeSnapshot({
  document,
  runtime,
  catalog,
}: {
  document: AtlasLoaderDependencies['document'];
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
}): void {
  const snapshot = JSON.stringify({ schemaVersion: '1', runtime, catalog });
  const existing = document.getElementById(RUNTIME_SNAPSHOT_ELEMENT_ID);

  if (existing) {
    existing.textContent = snapshot;

    return;
  }

  const element = document.createElement('script');
  element.id = RUNTIME_SNAPSHOT_ELEMENT_ID;
  element.type = 'application/json';
  element.textContent = snapshot;

  document.head.append(element);
}
