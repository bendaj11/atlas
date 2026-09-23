import { useMutation, useMutationState } from '@tanstack/react-query';
import { persistColumbusState } from '../../utils/persist-overrides/persist-overrides';
import { failureMessage } from '../../utils/errors/errors';
import type { ColumbusState } from '../../types/columbus-state';
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
    mutationFn: persistOverrides,
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

async function persistOverrides(columbusState: ColumbusState): Promise<void> {
  try {
    await persistColumbusState(columbusState);
  } catch (error) {
    throw new Error(
      failureMessage(
        error,
        'apply the selected overrides',
        'Reload the Atlas host tab, reopen Columbus, verify the selected build is available, and retry.',
      ),
    );
  }
}
