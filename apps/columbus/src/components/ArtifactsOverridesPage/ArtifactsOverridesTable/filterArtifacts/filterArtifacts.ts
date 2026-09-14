import type { Artifact } from '../../../../types/app.js';

interface FilterArtifactsInput {
  artifacts: Artifact[];
  searchValue: string;
  visibleOnly: boolean;
}

interface FilteredArtifacts {
  artifacts: Artifact[];
  totalCount: number;
}

export function filterArtifacts({
  artifacts,
  searchValue,
  visibleOnly,
}: FilterArtifactsInput): FilteredArtifacts {
  const displayed = visibleOnly
    ? artifacts.filter((artifact) => artifact.visible)
    : artifacts;
  const query = searchValue.trim().toLocaleLowerCase();
  const matching = query
    ? displayed.filter((artifact) =>
        [artifact.productionManifest.name, artifact.sourceDescription].some(
          (value) => value.toLocaleLowerCase().includes(query),
        ),
      )
    : displayed;

  return {
    artifacts: [...matching].sort(byOverrideRank),
    totalCount: displayed.length,
  };
}

function byOverrideRank(left: Artifact, right: Artifact): number {
  return (
    Number(right.overrideEnabled) - Number(left.overrideEnabled) ||
    Number(right.canToggle) - Number(left.canToggle)
  );
}
