import { ToggleSwitch } from '@wix/design-system';
import type { ArtifactProps } from '../../../../types/app.js';
import { useHost, useOverrides } from '../../../providers/index.js';

export const ArtifactOverrideToggle = ({ artifact }: ArtifactProps) => {
  const { status: hostStatus } = useHost();
  const { status: overrideStatus, toggleOverride } = useOverrides();
  const actionsDisabled =
    hostStatus === 'LOADING' || overrideStatus === 'APPLYING';
  const action = artifact.overrideEnabled ? 'Disable' : 'Enable';

  return (
    <ToggleSwitch
      size="small"
      disabled={actionsDisabled || !artifact.canToggle}
      checked={artifact.overrideEnabled}
      aria-label={`${action} ${artifact.productionManifest.name} override`}
      onChange={() => void toggleOverride(artifact.id)}
    />
  );
};
