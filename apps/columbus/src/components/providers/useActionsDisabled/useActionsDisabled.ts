import { useHost } from '../useHost/useHost';
import { useOverrides } from '../useOverrides/useOverrides';

export function useActionsDisabled(): boolean {
  const { status: hostStatus } = useHost();
  const { status: overrideStatus } = useOverrides();

  return hostStatus !== 'LOADED' || overrideStatus === 'APPLYING';
}
