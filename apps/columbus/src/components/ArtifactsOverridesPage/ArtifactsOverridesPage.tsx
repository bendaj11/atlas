import {
  Box,
  Button,
  Heading,
  Image,
  Loader,
  Page,
  Text,
} from '@wix/design-system';
import { Delete } from '@wix/wix-ui-icons-common';
import { useHost, useOverrides } from '../providers/index.js';
import { EmptyHostDataState } from '../EmptyHostDataState/EmptyHostDataState';
import { ArtifactsOverridesTable } from './ArtifactsOverridesTable/ArtifactsOverridesTable';

export function ArtifactsOverridesPage() {
  const { loadHost, message, status } = useHost();
  const {
    clearAllOverrides,
    hasOverrides,
    status: overrideStatus,
  } = useOverrides();

  const actionsDisabled = status !== 'LOADED' || overrideStatus === 'APPLYING';

  return (
    <Page height="100%" minWidth={0}>
      <Page.Header
        title={
          <Box gap="8px" verticalAlign="middle">
            <Image
              src="icons/columbus-main-logo.png"
              transparent
              width="35px"
            />
            <Heading size="medium">Columbus</Heading>
          </Box>
        }
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
