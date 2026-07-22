import { EmptyState, Loader, TextButton } from '@wix/design-system';
import { Refresh } from '@wix/wix-ui-icons-common';

interface EmptyHostDataStateProps {
  message: string;
  onRefresh: () => void;
}

export const EmptyHostDataState = ({
  message,
  onRefresh,
}: EmptyHostDataStateProps) => {
  return (
    <EmptyState
      dataHook="empty-host-data"
      image={<Loader status="error" />}
      title="No Atlas host found"
      subtitle={message}
    >
      <TextButton
        dataHook="refresh-host-data"
        prefixIcon={<Refresh />}
        onClick={onRefresh}
      >
        Refresh
      </TextButton>
    </EmptyState>
  );
};
