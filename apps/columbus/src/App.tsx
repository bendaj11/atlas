import {
  Box,
  EmptyState,
  Loader,
  LoaderStatus,
  SectionHelper,
  TextButton,
} from '@wix/design-system';
import { useEffect } from 'react';
import { usePopupHost, usePopupOverrides } from './context';
import { Refresh } from '@wix/wix-ui-icons-common';
import { AppRoutes } from './popup/components/AppRoutes/AppRoutes';

export function App() {
  const { hostData, loadHost, message, status } = usePopupHost();
  const { message: overrideMessage, status: overrideStatus } =
    usePopupOverrides();

  useEffect(() => {
    void loadHost();
  }, [loadHost]);

  const getLoaderStatus = (): LoaderStatus => {
    if (status === 'LOADING') {
      return 'loading';
    }

    if (status === 'ERROR') {
      return 'error';
    }

    return 'success';
  };

  const getEmptyStateTitle = (): string => {
    if (status === 'LOADING') {
      return 'Loading host artifacts';
    }

    if (status === 'ERROR') {
      return 'Failed to load host artifacts';
    }

    return 'No host artifacts found';
  };

  const shouldShowEmptyState = status !== 'LOADED' || !hostData;

  if (shouldShowEmptyState) {
    return (
      <EmptyState
        image={<Loader status={getLoaderStatus()} />}
        title={getEmptyStateTitle()}
        subtitle={message || overrideMessage}
      >
        {status !== 'LOADING' && (
          <TextButton prefixIcon={<Refresh />} onClick={loadHost}>
            Refresh
          </TextButton>
        )}
      </EmptyState>
    );
  }

  return (
    <Box direction="vertical" gap="12px">
      {message && (
        <SectionHelper
          dataHook="host-warning"
          skin="warning"
          title="Host warning"
        >
          {message}
        </SectionHelper>
      )}
      {overrideStatus === 'ERROR' && (
        <SectionHelper
          dataHook="override-error"
          skin="danger"
          title="Could not apply override"
        >
          {overrideMessage}
        </SectionHelper>
      )}
      <AppRoutes />
    </Box>
  );
}
