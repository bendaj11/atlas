import type { HostData } from '../../types/host-data';
import type { HostStatus } from '../../types/host-status';
import { useColumbusStateQuery } from '../useColumbusStateQuery/useColumbusStateQuery';

interface HostValue {
  hostData: HostData | undefined;
  status: HostStatus;
  message: string;
  loadHost: () => Promise<void>;
}

export function useHost(): HostValue {
  const { data, error, isError, isFetching, refetch } = useColumbusStateQuery();

  return {
    hostData: data?.hostData,
    status: hostStatusOf({ isError, isFetching }),
    message: error?.message ?? '',
    loadHost: async () => {
      await refetch();
    },
  };
}

function hostStatusOf({
  isError,
  isFetching,
}: {
  isError: boolean;
  isFetching: boolean;
}): HostStatus {
  if (isFetching) return 'LOADING';

  return isError ? 'ERROR' : 'LOADED';
}
