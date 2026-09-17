import { ToggleSwitch } from '@wix/design-system';
import type { ArtifactTableRow } from '../../../../types/artifact';
import { useActionsDisabled, useOverrides } from '../../../../hooks';

export const ArtifactOverrideToggle = ({
  artifact,
}: {
  artifact: ArtifactTableRow;
}) => {
  const { toggleOverride } = useOverrides();
  const actionsDisabled = useActionsDisabled();
  const action = artifact.overrideEnabled ? 'Disable' : 'Enable';

  return (
    <ToggleSwitch
      dataHook="artifact-override-toggle"
      size="small"
      disabled={actionsDisabled || !artifact.canToggle}
      checked={artifact.overrideEnabled}
      aria-label={`${action} ${artifact.deployedArtifactVersion.name} override`}
      onChange={() => void toggleOverride(artifact.deployedArtifactVersion.id)}
    />
  );
};
