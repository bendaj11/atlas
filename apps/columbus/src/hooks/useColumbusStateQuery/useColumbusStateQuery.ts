import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumbusState } from '../../types/columbus-state';
import { loadColumbusState } from '../../utils/load-columbus-state/load-columbus-state';

export const COLUMBUS_STATE_QUERY_KEY = ['columbusState'] as const;

export function useColumbusStateQuery() {
  const queryClient = useQueryClient();

  return useQuery<ColumbusState, Error>({
    queryKey: COLUMBUS_STATE_QUERY_KEY,
    queryFn: () =>
      loadColumbusState({
        bypassCache:
          queryClient.getQueryData(COLUMBUS_STATE_QUERY_KEY) !== undefined,
      }),
  });
}
