import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumbusState } from '../../types/columbus-state';
import {
  loadColumbusState,
  COLUMBUS_STATE_QUERY_KEY,
} from '../columbus-state/columbus-state';

export function useColumbusStateQuery() {
  const queryClient = useQueryClient();

  return useQuery<ColumbusState, Error>({
    queryKey: COLUMBUS_STATE_QUERY_KEY,
    queryFn: () =>
      loadColumbusState(
        queryClient.getQueryData(COLUMBUS_STATE_QUERY_KEY) !== undefined,
      ),
  });
}
