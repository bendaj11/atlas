import { useMutation, useMutationState } from '@tanstack/react-query';
import type { ColumbusState } from '../../types/columbus-state';
import { persistOverrides } from '../overrides/overrides';
import { useColumbusState } from '../useColumbusState/useColumbusState';

const PERSIST_OVERRIDES_MUTATION_KEY = ['persistOverrides'] as const;

interface PersistOverridesMutation {
  error: Error | null;
  isError: boolean;
  isPending: boolean;
  mutateAsync: (columbusState: ColumbusState) => Promise<void>;
}

export function usePersistOverridesMutation(): PersistOverridesMutation {
  const { setColumbusState } = useColumbusState();
  const { mutateAsync } = useMutation<void, Error, ColumbusState>({
    mutationKey: PERSIST_OVERRIDES_MUTATION_KEY,
    mutationFn: (columbusState) => persistOverrides(columbusState),
    onMutate: (columbusState) => setColumbusState(columbusState),
    onSuccess: () => window.close(),
  });
  const latest = useMutationState({
    filters: { mutationKey: PERSIST_OVERRIDES_MUTATION_KEY },
    select: (mutation) => mutation.state,
  }).at(-1);

  return {
    error: (latest?.error as Error | null | undefined) ?? null,
    isError: latest?.status === 'error',
    isPending: latest?.status === 'pending',
    mutateAsync,
  };
}
