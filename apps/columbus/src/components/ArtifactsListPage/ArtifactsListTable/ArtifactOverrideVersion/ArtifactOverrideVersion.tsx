import type {
  ArtifactTableRow,
  OverrideType,
} from '../../../../types/artifact';
import { versionBuildIdLabel } from '../../../../utils/artifact-version-utils/artifact-version-utils';
import { Text, Tooltip } from '@wix/design-system';

const OVERRIDE_TYPE_LABELS: Record<OverrideType, string> = {
  custom: 'Custom URL override',
  pr: 'PR / MR preview override',
  production: 'Other release override',
};

export const ArtifactOverrideVersion = ({
  artifact,
}: {
  artifact: ArtifactTableRow;
}) => {
  const hasOverride = artifact.overrideEnabled;
  const displayedVersion = hasOverride
    ? artifact.sourceDescription
    : versionBuildIdLabel(artifact.deployedArtifactVersion);

  const getTextSkin = () => {
    if (artifact.loadError) return 'error';
    if (hasOverride) return 'standard';
    return 'disabled';
  };

  return (
    <Tooltip
      dataHook="override-version-tooltip"
      content={
        <Text size="tiny" light>
          {artifact.loadError ??
            (artifact.overrideType &&
              OVERRIDE_TYPE_LABELS[artifact.overrideType])}
        </Text>
      }
      disabled={!artifact.loadError && !hasOverride}
      inline
    >
      <Text dataHook="override-version" size="small" skin={getTextSkin()}>
        {displayedVersion}
      </Text>
    </Tooltip>
  );
};
