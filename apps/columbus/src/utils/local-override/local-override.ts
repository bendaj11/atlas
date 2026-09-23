import type { ArtifactVersion } from '../../types/artifact-version';
import { isRecord } from '../messages/messages';

interface FederationMetadata {
  name: string;
  exposes: Array<{ key?: unknown; outFileName?: unknown }>;
}

export async function validateLocalOverride(
  manifest: ArtifactVersion,
): Promise<void> {
  if (manifest.channel !== 'local') return;

  const failure = await remoteEntryFailure(
    manifest.remoteEntryUrl,
    manifest.exposes?.entry ?? './entry',
  );
  if (failure) throw new Error(failure);
}

async function remoteEntryFailure(
  remoteEntryUrl: string,
  exposedModule: string,
): Promise<string | undefined> {
  try {
    const response = await fetch(remoteEntryUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok)
      return `Local override remote entry returned HTTP ${response.status}.`;

    const metadata: unknown = await response.json();
    if (!isFederationMetadata(metadata))
      return 'Local override remote entry is not valid federation metadata.';

    const expose = metadata.exposes.find(
      (candidate) => candidate.key === exposedModule,
    );
    if (typeof expose?.outFileName !== 'string')
      return `Local override remote entry does not expose ${exposedModule}.`;

    return undefined;
  } catch {
    return 'Local override remote entry is unreachable. Start its development server, then retry.';
  }
}

function isFederationMetadata(value: unknown): value is FederationMetadata {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    Array.isArray(value.exposes)
  );
}
