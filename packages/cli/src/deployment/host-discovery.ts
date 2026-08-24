import {
  assertAtlasHostDiscovery,
  type AtlasHostDiscovery,
  type AtlasStaticRegistry,
} from '@atlas/schema';

export function hostDiscoveryPath(hostId: string): string {
  return `hosts/${hostId}/discovery.json`;
}

export function createHostDiscovery(
  registry: AtlasStaticRegistry,
  hostId: string,
  registryUrl: string,
): AtlasHostDiscovery {
  const bindings = Object.entries(registry.deployments)
    .flatMap(([environment, deployment]) => {
      const selection = deployment.hosts[hostId];
      return (selection?.baseUrls ?? []).map((baseUrl) => ({
        baseUrl,
        environment,
        manifestUrl: new URL(
          `environments/${environment}/hosts/${hostId}/manifest.json`,
          `${registryUrl}/`,
        ).href,
        ...(selection?.externalRegistries?.length
          ? { externalRegistries: selection.externalRegistries }
          : {}),
      }));
    })
    .sort(
      (left, right) =>
        left.baseUrl.localeCompare(right.baseUrl) ||
        left.environment.localeCompare(right.environment),
    );
  const discovery: AtlasHostDiscovery = {
    schemaVersion: '1',
    hostId,
    bindings,
  };
  assertAtlasHostDiscovery(discovery);
  return discovery;
}
