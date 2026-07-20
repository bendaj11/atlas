import React from 'react';
import { EmptyState, Loader, TextButton } from '@wix/design-system';
import { Refresh } from '@wix/wix-ui-icons-common';

interface EmptyHostDataStateProps {
  message: string;
  onRefresh: () => void;
  disableRefresh: boolean;
}

export const EmptyHostDataState = ({
  message,
  onRefresh,
  disableRefresh,
}: EmptyHostDataStateProps) => {
  return (
    <EmptyState
      image={<Loader status="error" />}
      title="No Atlas host found"
      subtitle={message}
    >
      <TextButton
        prefixIcon={<Refresh />}
        onClick={onRefresh}
        disabled={disableRefresh}
      >
        Refresh
      </TextButton>
    </EmptyState>
  );
};
