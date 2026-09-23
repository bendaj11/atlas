import type { HostData } from '../../types/host-data';
import { mapWithConcurrency } from '../concurrency/concurrency';
import { messageFromError } from '../errors/errors';
import {
  type ArtifactRegistry,
  type Registry,
  registryRootFor,
  uniqueManifests,
} from '../artifact-registry/artifact-registry';
import { readCatalog, readRuntimeConfig } from '../host-catalog/host-catalog';
import {
  localOverridesOf,
  readRuntimeErrors,
  readStoredOverrides,
  readVisibleAppIds,
} from '../page-runtime-state/page-runtime-state';

const LOOKUP_CONCURRENCY = 8;

export async function inspectAtlasHost(
  documentKey: string,
  registry: ArtifactRegistry,
): Promise<HostData> {
  const config = await readRuntimeConfig();
  const catalog = await readCatalog(config, registry.loadManifest);
  if (catalog.hostId !== config.hostId)
    throw new Error(
      `Atlas deployment targets host ${catalog.hostId}, but runtime overrideOptions targets ${config.hostId}.`,
    );

  const registryRoot = registryRootFor(config);
  const registryRead = registryRoot
    ? await readRegistrySafely(registry, registryRoot)
    : {};
  const deployed = [
    catalog.host,
    ...catalog.apps,
    ...(catalog.widgetProviders ?? []),
  ];
  const versionReads = await mapWithConcurrency(
    deployed,
    async (manifest) => {
      const key = manifest.id;
      if (!registryRead.registry || !registryRoot)
        return { key, manifests: [manifest] };

      try {
        return {
          key,
          ...(await registry.readVersions(
            manifest,
            registryRead.registry,
            registryRoot,
          )),
        };
      } catch (error) {
        return { key, manifests: [manifest], error: messageFromError(error) };
      }
    },
    LOOKUP_CONCURRENCY,
  );
  const stored = readStoredOverrides(documentKey, config.hostId);

  return {
    config,
    pageUrl: location.href,
    catalog: {
      ...catalog,
      widgetProviders: uniqueManifests(catalog.widgetProviders ?? []),
    },
    versions: Object.fromEntries(
      versionReads.map(({ key, manifests }) => [key, manifests]),
    ),
    overrides: stored.overrides ?? localOverridesOf(config.hostId, deployed),
    overrideScope: stored.overrideScope,
    visibleAppIds: readVisibleAppIds(),
    runtimeErrors: readRuntimeErrors(),
    versionErrors: [
      ...(registryRead.error ? [registryRead.error] : []),
      ...versionReads.flatMap(({ error }) => (error ? [error] : [])),
    ],
  };
}

async function readRegistrySafely(
  registry: ArtifactRegistry,
  root: string,
): Promise<{ registry?: Registry; error?: string }> {
  try {
    return { registry: await registry.readRegistry(root) };
  } catch (error) {
    return { error: messageFromError(error) };
  }
}
