import type { HostLoadContext, RemoteMetadata } from '../host-loader.types.js';

const REBUILD_COMPLETE_EVENT = 'federation-rebuild-complete';

export function watchHostBuildNotifications({
  metadata,
  manifest,
  dependencies,
}: Pick<HostLoadContext, 'manifest' | 'dependencies'> & {
  metadata: RemoteMetadata;
}): void {
  if (!metadata.buildNotificationsEndpoint) return;
  if (!dependencies.createEventSource) return;

  const source = dependencies.createEventSource(
    new URL(metadata.buildNotificationsEndpoint, manifest.remoteEntryUrl),
  );

  source.onmessage = ({ data }) => {
    if (hasCompletedFederationBuild(data)) dependencies.reloadPage();
  };
}

function hasCompletedFederationBuild(data: string): boolean {
  try {
    return JSON.parse(data).type === REBUILD_COMPLETE_EVENT;
  } catch {
    return false;
  }
}
