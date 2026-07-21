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
      image={<Loader status="error" />}
      title="No Atlas host found"
      subtitle={message}
    >
      <TextButton prefixIcon={<Refresh />} onClick={onRefresh}>
        Refresh
      </TextButton>
    </EmptyState>
  );
};
