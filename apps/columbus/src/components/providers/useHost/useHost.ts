import type { AtlasHostData as HostData } from '../../../types/contracts';
import type { HostStatus } from '../../../types/app';
import { hostStatusOf } from '../columbus-state/columbus-state';
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
