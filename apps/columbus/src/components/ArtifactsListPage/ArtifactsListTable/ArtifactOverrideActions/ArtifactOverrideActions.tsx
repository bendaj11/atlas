import type { ArtifactTableRow } from '../../../../types/artifact';
import { Delete, Edit } from '@wix/wix-ui-icons-common';
import { TableActionCell } from '@wix/design-system';
import { useActionsDisabled, useOverrides } from '../../../../hooks';
import { useNavigate } from 'react-router-dom';
import { ARTIFACT_OVERRIDE_ROUTE } from '../../../../routing/routes/routes';

export const ArtifactOverrideActions = ({
  artifact,
}: {
  artifact: ArtifactTableRow;
}) => {
  const navigate = useNavigate();
  const { clearOverride } = useOverrides();
  const actionsDisabled = useActionsDisabled();

  return (
    <TableActionCell
      dataHook="artifact-override-actions"
      size="small"
      alwaysShowSecondaryActions
      numOfVisibleSecondaryActions={2}
      secondaryActions={[
        ...(artifact.canToggle
          ? [
              {
                text: 'Clear',
                icon: <Delete />,
                skin: 'destructive' as const,
                tooltipProps: { disabled: true },
                disabled: actionsDisabled,
                onClick: () =>
                  void clearOverride(artifact.deployedArtifactVersion.id),
              },
            ]
          : []),
        {
          text: 'Edit',
          icon: <Edit />,
          tooltipProps: { disabled: true },
          disabled: actionsDisabled,
          onClick: () =>
            void navigate(ARTIFACT_OVERRIDE_ROUTE, {
              state: { artifact },
            }),
        },
      ]}
    />
  );
};
