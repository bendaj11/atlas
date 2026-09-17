import { ToggleSwitch } from '@wix/design-system';
import type { Artifact } from '../../../../types/artifact';
import { useActionsDisabled, useOverrides } from '../../../../state';

export const ArtifactOverrideToggle = ({
  artifact,
}: {
  artifact: Artifact;
}) => {
  const { toggleOverride } = useOverrides();
  const actionsDisabled = useActionsDisabled();
  const action = artifact.overrideEnabled ? 'Disable' : 'Enable';

  return (
    <ToggleSwitch
      size="small"
      disabled={actionsDisabled || !artifact.canToggle}
      checked={artifact.overrideEnabled}
      aria-label={`${action} ${artifact.productionArtifactVersion.name} override`}
      onChange={() => void toggleOverride(artifact.key)}
    />
  );
};
