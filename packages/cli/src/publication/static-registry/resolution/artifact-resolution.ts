import type { AtlasRegistryArtifact, AtlasStaticRegistry } from '@atlas/schema';
import type { AtlasResolvedArtifact, AtlasResolvedRelease } from '../types.js';

export function resolveRegistryArtifact(
  registry: AtlasStaticRegistry,
  identifier: string,
): AtlasResolvedArtifact {
  const byId = findArtifactsMatching(
    registry,
    (artifact) => artifact.id === identifier,
  );

  if (byId.length === 1) return byId[0]!;

  const byName = findArtifactsMatching(
    registry,
    (artifact) =>
      artifact.packageName === identifier || artifact.name === identifier,
  );
  const matches = [
    ...new Map(byName.map((match) => [match.artifact.id, match])).values(),
  ];

  if (matches.length === 1) return matches[0]!;

  if (matches.length > 1)
    throw new Error(
      `Atlas artifact identifier "${identifier}" is ambiguous. Use one of these stable IDs: ${matches.map(({ artifact }) => artifact.id).join(', ')}.`,
    );

  throw new Error(`Atlas artifact "${identifier}" is not registered.`);
}

export function resolveRelease(
  registry: AtlasStaticRegistry,
  identifier: string,
  selector: string,
): AtlasResolvedRelease {
  const { kind, artifact } = resolveRegistryArtifact(registry, identifier);

  if (selector === 'latest') {
    const latest = artifact.latest
      ? artifact.releases[artifact.latest]
      : undefined;
    if (!artifact.latest || !latest)
      throw new Error(`Atlas artifact "${identifier}" has no latest release.`);

    return { kind, artifact, version: artifact.latest, manifest: latest };
  }

  const exact = artifact.releases[selector];

  if (exact) return { kind, artifact, version: selector, manifest: exact };

  throw new Error(
    `Atlas selector "${selector}" is neither a release nor latest for "${identifier}".`,
  );
}

function findArtifactsMatching(
  registry: AtlasStaticRegistry,
  matches: (artifact: AtlasRegistryArtifact) => boolean,
): AtlasResolvedArtifact[] {
  return [
    ...Object.values(registry.apps)
      .filter(matches)
      .map((artifact) => ({ kind: 'app' as const, artifact })),
    ...Object.values(registry.hosts)
      .filter(matches)
      .map((artifact) => ({ kind: 'host' as const, artifact })),
  ];
}
