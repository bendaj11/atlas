import type { ArtifactProps } from '../../../../types/app.js';
import { Delete, Edit } from '@wix/wix-ui-icons-common';
import { TableActionCell } from '@wix/design-system';
import { useHost, useOverrides } from '../../../providers/index.js';
import { useNavigate } from 'react-router-dom';
import { ARTIFACT_CONFIGURATION_ROUTE } from '../../../../scripts/routing/routes/routes.js';

export const ArtifactOverrideActions = ({ artifact }: ArtifactProps) => {
  const navigate = useNavigate();
  const { status: hostStatus } = useHost();
  const { clearOverride, status: overrideStatus } = useOverrides();
  const actionsDisabled =
    hostStatus === 'LOADING' || overrideStatus === 'APPLYING';

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
                onClick: () => void clearOverride(artifact.id),
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
