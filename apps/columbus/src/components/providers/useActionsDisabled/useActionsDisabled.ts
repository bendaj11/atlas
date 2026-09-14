import { useHost } from '../HostContext/HostContext.js';
import { useOverrides } from '../OverridesContext/OverridesContext.js';

export function useActionsDisabled(): boolean {
  const { status: hostStatus } = useHost();
  const { status: overrideStatus } = useOverrides();

  return hostStatus !== 'LOADED' || overrideStatus === 'APPLYING';
}
