import { useQueryClient } from '@tanstack/react-query';
import type { ColumbusState } from '../../../types/app';
import { COLUMBUS_STATE_QUERY_KEY } from '../columbus-state/columbus-state';
import { useColumbusStateQuery } from '../useColumbusStateQuery/useColumbusStateQuery';

type ColumbusStateUpdater = (
  current: ColumbusState | undefined,
) => ColumbusState | undefined;

interface ColumbusStateValue {
  columbusState: ColumbusState | undefined;
  setColumbusState: (update: ColumbusState | ColumbusStateUpdater) => void;
}

export function useColumbusState(): ColumbusStateValue {
  const queryClient = useQueryClient();
  const { data } = useColumbusStateQuery();

  return {
    columbusState: data,
    setColumbusState: (update) =>
      queryClient.setQueryData<ColumbusState>(COLUMBUS_STATE_QUERY_KEY, update),
  };
}
