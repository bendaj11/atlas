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

interface PersistOverridesContext {
  previousColumbusState: ColumbusState | undefined;
}

export function usePersistOverridesMutation(): PersistOverridesMutation {
  const { columbusState, setColumbusState } = useColumbusState();
  const { mutateAsync } = useMutation<
    void,
    Error,
    ColumbusState,
    PersistOverridesContext
  >({
    mutationKey: PERSIST_OVERRIDES_MUTATION_KEY,
    mutationFn: persistOverrides,
    onMutate: (nextColumbusState) => {
      setColumbusState(nextColumbusState);

      return { previousColumbusState: columbusState };
    },
    onError: (_error, _nextColumbusState, context) => {
      if (context?.previousColumbusState)
        setColumbusState(context.previousColumbusState);
    },
    onSuccess: () => window.close(),
  });
  const latest = useMutationState({
    filters: { mutationKey: PERSIST_OVERRIDES_MUTATION_KEY },
    select: (mutation) => mutation.state,
  }).at(-1);

  return {
    error: latest?.error ?? null,
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
