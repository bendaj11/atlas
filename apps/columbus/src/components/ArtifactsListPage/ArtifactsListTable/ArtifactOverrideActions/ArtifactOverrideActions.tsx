import type { Artifact } from '../../../../types/artifact';
import { Delete, Edit } from '@wix/wix-ui-icons-common';
import { TableActionCell } from '@wix/design-system';
import { useActionsDisabled, useOverrides } from '../../../../state';
import { useNavigate } from 'react-router-dom';
import { ARTIFACT_CONFIGURATION_ROUTE } from '../../../../scripts/routing/routes/routes';

export const ArtifactOverrideActions = ({
  artifact,
}: {
  artifact: Artifact;
}) => {
  const navigate = useNavigate();
  const { clearOverride } = useOverrides();
  const actionsDisabled = useActionsDisabled();

  return (
    <TableActionCell
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
                onClick: () => void clearOverride(artifact.key),
              },
            ]
          : []),
        {
          text: 'Edit',
          icon: <Edit />,
          tooltipProps: { disabled: true },
          disabled: actionsDisabled,
          onClick: () =>
            navigate(ARTIFACT_CONFIGURATION_ROUTE, {
              state: { artifact },
            }),
        },
      ]}
    />
  );
};
