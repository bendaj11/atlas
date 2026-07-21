import { ToggleSwitch } from '@wix/design-system';
import type { ArtifactProps } from '../../../popup/types';
import { usePopupHost, usePopupOverrides } from '../../../context';

export const ArtifactOverrideToggle = ({ artifact }: ArtifactProps) => {
  const { status: hostStatus } = usePopupHost();
  const { status: overrideStatus, toggleOverride } = usePopupOverrides();
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
