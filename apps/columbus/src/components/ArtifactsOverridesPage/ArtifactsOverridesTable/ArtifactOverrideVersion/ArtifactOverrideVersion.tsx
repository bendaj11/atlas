import type { ArtifactProps, OverrideType } from '../../../../types/app.js';
import { Text, Tooltip } from '@wix/design-system';

const OVERRIDE_TYPE_LABELS: Record<OverrideType, string> = {
  none: '',
  custom: 'Custom URL override',
  pr: 'Pull request override',
  production: 'Production override',
};

export const ArtifactOverrideVersion = ({ artifact }: ArtifactProps) => {
  const hasOverride = artifact.overrideType !== 'none';
  const displayedVersion = hasOverride
    ? artifact.sourceDescription
    : artifact.productionManifest.version;

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
          {artifact.loadError ?? OVERRIDE_TYPE_LABELS[artifact.overrideType]}
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
