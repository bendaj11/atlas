import type { AtlasStaticRegistry } from '@atlas/schema';
import {
  assertEnvironmentName,
  resolveRegistryArtifact,
} from '../../publication/index.js';
import { CliError } from '../../shared/index.js';
import { readSourceEnvironmentState } from '../registry-access/registry-access.js';
import type {
  ArtifactKind,
  RegistryAccess,
  ArtifactSelection,
} from '../types.js';

export async function selectArtifactVersion({
  access,
  registry,
  identifier,
  selector,
}: {
  access: RegistryAccess;
  registry: AtlasStaticRegistry;
  identifier: string;
  selector: string;
}): Promise<ArtifactSelection> {
  const { artifact, kind } = resolveRegistryArtifact(registry, identifier);
  const version =
    selector === 'latest'
      ? artifact.latest
      : artifact.releases[selector]
        ? selector
        : await readSourceEnvironmentVersion({
            access,
            environment: selector,
            kind,
            id: artifact.id,
          });
  const descriptor = version ? artifact.releases[version] : undefined;

  if (!version || !descriptor)
    throw new CliError(
      `Atlas selector "${selector}" is neither an exact release, latest, nor a source environment selection for "${identifier}".`,
      [
        `Pass --version <release> with a version published for "${identifier}".`,
        'Pass --version latest or the name of a source environment that selects this artifact.',
      ],
      { code: 'ATLAS_VERSION_SELECTOR_INVALID' },
    );

  return { kind, id: artifact.id, version };
}

async function readSourceEnvironmentVersion({
  access,
  environment,
  kind,
  id,
}: {
  access: RegistryAccess;
  environment: string;
  kind: ArtifactKind;
  id: string;
}): Promise<string | undefined> {
  assertEnvironmentName(environment);

  const deployment = await readSourceEnvironmentState({ access, environment });

  return deployment?.[kind === 'app' ? 'apps' : 'hosts'][id]?.version;
}
