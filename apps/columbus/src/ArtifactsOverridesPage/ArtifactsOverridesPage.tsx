import { Box, Button, Heading, Loader, Page, Text } from '@wix/design-system';
import { Delete } from '@wix/wix-ui-icons-common';
import { usePopupHost, usePopupOverrides } from '../context';
import { EmptyHostDataState } from '../EmptyHostDataState/EmptyHostDataState';
import { ArtifactsOverridesTable } from './ArtifactsOverridesTable/ArtifactsOverridesTable';

export function ArtifactsOverridesPage() {
  const { loadHost, message, status } = usePopupHost();
  const {
    clearAllOverrides,
    hasOverrides,
    status: overrideStatus,
  } = usePopupOverrides();

  const actionsDisabled = status !== 'LOADED' || overrideStatus === 'APPLYING';

  return (
    <Page height="100%" minWidth={0}>
      <Page.Header
        title={<Heading size="medium">Columbus</Heading>}
        subtitle={
          <Text size="small" secondary>
            Inspect artifacts and manage runtime overrides.
          </Text>
        }
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
        {status === 'LOADING' && (
          <Box align="center" verticalAlign="middle" paddingTop="80px">
            <Loader status="loading" />
          </Box>
        )}
        {status === 'ERROR' && (
          <EmptyHostDataState
            message={message}
            onRefresh={() => void loadHost()}
          />
        )}
        {status === 'LOADED' && <ArtifactsOverridesTable />}
      </Page.Content>
    </Page>
  );
}
