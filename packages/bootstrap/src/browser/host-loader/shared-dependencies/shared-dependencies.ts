import type {
  HostLoadContext,
  HostLoaderDependencies,
  RemoteMetadata,
} from '../host-loader.types.js';

export type SharedDependenciesDependencies = Pick<
  HostLoaderDependencies,
  'document'
>;
import { HostRemoteInvalidError } from '../../../shared/errors/index.js';

export function installHostSharedDependencies({
  metadata,
  manifest,
  dependencies,
}: Pick<HostLoadContext, 'manifest'> & {
  metadata: RemoteMetadata;
  dependencies: SharedDependenciesDependencies;
}): void {
  if (!metadata.shared?.length) return;

  const { remoteEntryUrl } = manifest;
  const { document } = dependencies;
  const imports: Record<string, string> = {};

  for (const shared of metadata.shared) {
    if (
      typeof shared.packageName !== 'string' ||
      typeof shared.outFileName !== 'string'
    ) {
      throw new HostRemoteInvalidError(
        `Selected host remote entry "${remoteEntryUrl}" declares shared dependency ${JSON.stringify(shared)} without packageName and outFileName.`,
      );
    }

    imports[shared.packageName] = new URL(
      shared.outFileName,
      remoteEntryUrl,
    ).href;
  }

  const importMap = document.createElement('script');
  importMap.type = 'importmap-shim';
  importMap.textContent = JSON.stringify({ imports });

  document.head.append(importMap);
}
