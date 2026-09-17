import type {
  HostLoadContext,
  HostLoaderDependencies,
  RemoteMetadata,
} from '../host-loader.types.js';

export type BuildNotificationsDependencies = Pick<
  HostLoaderDependencies,
  'createEventSource' | 'reloadPage'
>;

const REBUILD_COMPLETE_EVENT = 'federation-rebuild-complete';

export function watchHostBuildNotifications({
  metadata,
  manifest,
  dependencies,
}: Pick<HostLoadContext, 'manifest'> & {
  metadata: RemoteMetadata;
  dependencies: BuildNotificationsDependencies;
}): void {
  if (!metadata.buildNotificationsEndpoint) return;

  if (!dependencies.createEventSource) return;

  const source = dependencies.createEventSource(
    new URL(metadata.buildNotificationsEndpoint, manifest.remoteEntryUrl),
  );

  source.onmessage = ({ data }) => {
    if (isFederationRebuildCompleteEvent(data)) dependencies.reloadPage();
  };
}

function isFederationRebuildCompleteEvent(data: string): boolean {
  try {
    return JSON.parse(data).type === REBUILD_COMPLETE_EVENT;
  } catch {
    return false;
  }
}
