import type { ArtifactProps } from '../../../popup/types';
import { Delete, Edit } from '@wix/wix-ui-icons-common';
import { TableActionCell } from '@wix/design-system';
import { usePopupHost, usePopupOverrides } from '../../../context';
import { useNavigate } from 'react-router-dom';
import { ARTIFACT_CONFIGURATION_ROUTE } from '../../../popup/popup-routes';

export const ArtifactOverrideActions = ({ artifact }: ArtifactProps) => {
  const navigate = useNavigate();
  const { status: hostStatus } = usePopupHost();
  const { clearOverride, status: overrideStatus } = usePopupOverrides();
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
