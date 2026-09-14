import { useHost } from '../HostContext/HostContext';
import { useOverrides } from '../OverridesContext/OverridesContext';

export function useActionsDisabled(): boolean {
  const { status: hostStatus } = useHost();
  const { status: overrideStatus } = useOverrides();

  return hostStatus !== 'LOADED' || overrideStatus === 'APPLYING';
}
