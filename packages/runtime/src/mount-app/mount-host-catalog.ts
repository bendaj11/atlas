import type { AtlasMountedApp } from '../host-runtime/host-runtime.types.js';
import { resolveRuntimeManifests } from '../loader/catalog/catalog-resolution.js';
import { loadHostDeployment } from '../loader/deployment/deployment.js';
import { PERMISSIVE_TRUST_POLICY } from '../loader/trust/trust-policy.js';
import { createWidgetLoader } from '../widget-loader/widget-loader.js';
import { pickWidgetUiOptionsFrom } from '../widget-loader/widget-ui-options.js';
import { mountApp } from './mount-app.js';
import type { AtlasHostCatalogMountOptions } from './mount-host-catalog.types.js';

export async function loadAndMountHostCatalog(
  options: AtlasHostCatalogMountOptions,
): Promise<AtlasMountedApp[]> {
  const catalog = await loadHostDeployment({
    manifestUrl: options.manifestUrl,
    expectedHostId: options.hostId,
    ...(options.artifactRegistryUrl
      ? { artifactRegistryUrl: options.artifactRegistryUrl }
      : {}),
    ...(options.fetchBytes ? { fetchBytes: options.fetchBytes } : {}),
  });
  const manifests = resolveRuntimeManifests(catalog, options.overrides);
  const trustPolicy = options.trustPolicy ?? PERMISSIVE_TRUST_POLICY;
  const widgetLoader = createWidgetLoader({
    manifests,
    sdk: options.sdk,
    options: {
      ...(options.importWidget ? { importWidget: options.importWidget } : {}),
      trustPolicy,
      ...pickWidgetUiOptionsFrom(options),
    },
  });
  const mounted: AtlasMountedApp[] = [];

  for (const manifest of manifests) {
    const container = options.resolveContainer(manifest);

    if (!container) continue;
    mounted.push(
      await mountApp({
        ...options,
        trustPolicy,
        widgetLoader,
        manifest,
        container,
      }),
    );
  }

  return mounted;
}
