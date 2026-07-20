import { Loader } from '@wix/design-system';
import { useEffect } from 'react';
import { EmptyHostDataState } from './EmptyHostDataState/EmptyHostDataState.js';
import { PopupApp } from './popup/components/PopupApp.js';
import { usePopupHost } from './context';

export function App() {
  const { hostData, loadHost, message, status } = usePopupHost();

  useEffect(() => {
    void loadHost();
  }, [loadHost]);

  if (!hostData && status === 'LOADING') {
    return (
      <Loader
        size="large"
        status="loading"
        text="Loading host data"
        statusMessage={message}
      />
    );
  }

  if (!hostData) {
    return (
      <EmptyHostDataState
        onRefresh={loadHost}
        message={message}
        disableRefresh={status === 'LOADING'}
      />
    );
  }
  return <PopupApp />;
}
