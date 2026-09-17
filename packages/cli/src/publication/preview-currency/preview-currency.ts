import type { AtlasPublishedArtifactManifest } from '@atlas/schema';
import { cliError } from '../../shared/index.js';
import { resolvePullRequestStatus } from '../pull-request/pull-request.js';
import type { AtlasRegistryConfig } from '../registry-config.js';

export async function assertPreviewIsCurrent({
  manifest,
  config,
}: {
  manifest: AtlasPublishedArtifactManifest;
  config: AtlasRegistryConfig | undefined;
}): Promise<void> {
  if (!manifest.preview) return;

  const status = await resolvePullRequestStatus(
    {
      artifactId: manifest.id,
      prNumber: manifest.preview.number,
      gitSha: manifest.preview.gitSha,
      ...(manifest.preview.gitBranch
        ? { gitBranch: manifest.preview.gitBranch }
        : {}),
    },
    config,
  );

  if (status.state !== 'open')
    throw cliError(
      `Preview #${manifest.preview.number} is ${status.state}.`,
      'Publish previews only from open pull requests; nothing to do for this job.',
      { code: 'ATLAS_PREVIEW_CLOSED' },
    );

  if (status.headSha !== manifest.preview.gitSha)
    throw cliError(
      `Stale preview job: built ${manifest.preview.gitSha}, current head is ${status.headSha}.`,
      'Let the CI job for the current head publish; this build is superseded.',
      { code: 'ATLAS_PREVIEW_STALE' },
    );
}
