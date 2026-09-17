import type { HostLoadContext, RemoteMetadata } from '../host-loader.types.js';
import { HostRemoteInvalidError } from '../../../shared/errors/index.js';

export function installHostSharedDependencies({
  metadata,
  manifest,
  dependencies,
}: Pick<HostLoadContext, 'manifest' | 'dependencies'> & {
  metadata: RemoteMetadata;
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
