import { Box, Button, Page } from '@wix/design-system';
import { Delete } from '@wix/wix-ui-icons-common';
import { usePopupHost } from '../../context/PopupHostContext';
import { usePopupOverrides } from '../../context/PopupOverridesContext';
import { OverrideTable } from './OverrideTable.js';

export function ArtifactsListPage() {
  const { hostData, status } = usePopupHost();
  const {
    clearAllOverrides,
    hasOverrides,
    status: overrideStatus,
  } = usePopupOverrides();
  const actionsDisabled = status === 'LOADING' || overrideStatus === 'APPLYING';
  if (!hostData) return null;

  return (
    <Page>
      <Page.Header
        title={hostData.catalog.host.name}
        subtitle={hostData.config.hostId}
        actionsBar={
          <Box align="center">
            <Button
              size="small"
              skin="destructive"
              priority="secondary"
              onClick={() => void clearAllOverrides()}
              prefixIcon={<Delete />}
              disabled={actionsDisabled || !hasOverrides}
            >
              Clear
            </Button>
          </Box>
        }
      />
      <Page.Content>
        <OverrideTable />
      </Page.Content>
    </Page>
  );
}
