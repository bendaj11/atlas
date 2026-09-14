import { ToggleSwitch } from '@wix/design-system';
import type { ArtifactProps } from '../../../../types/app';
import { useActionsDisabled, useOverrides } from '../../../providers/index';

export const ArtifactOverrideToggle = ({ artifact }: ArtifactProps) => {
  const { toggleOverride } = useOverrides();
  const actionsDisabled = useActionsDisabled();
  const action = artifact.overrideEnabled ? 'Disable' : 'Enable';

  return (
    <ToggleSwitch
      size="small"
      disabled={actionsDisabled || !artifact.canToggle}
      checked={artifact.overrideEnabled}
      aria-label={`${action} ${artifact.productionManifest.name} override`}
      onChange={() => void toggleOverride(artifact.key)}
    />
  );
};
