import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from 'react';
import type { AtlasHostData as HostData } from '../contracts';
import {
  errorMessage,
  readDisabledOverrides,
  readHostData,
  updateActionBadge,
} from '../popup/atlas-host';
import {
  extractActiveOverrideManifests,
  includeDisabledAppsInCatalog,
} from '../popup/override-manifests';
import { createHostWarningMessage } from '../popup/host-warning';
import type { HostStatus } from '../popup/types';
import { usePopupSession } from './PopupSessionContext';

interface PopupHostContextValue {
  hostData: HostData | undefined;
  status: HostStatus;
  message: string;
  loadHost: () => Promise<void>;
}

const PopupHostContext = createContext<PopupHostContextValue | undefined>(
  undefined,
);

export function PopupHostProvider({ children }: { children: ReactNode }) {
  const { session, setSession } = usePopupSession();
  const [status, setStatus] = useState<HostStatus>('LOADING');
  const [message, setMessage] = useState('Reading active Atlas host...');
  const lastActiveTabId = useRef<number>(undefined);

  async function loadHost(): Promise<void> {
    setStatus('LOADING');
    setMessage('Reading active Atlas host...');

    try {
      const result = await readHostData(lastActiveTabId.current);
      const scope = result.hostData.overrideScope === 'tab' ? 'tab' : 'all';
      const activeOverrides = extractActiveOverrideManifests(result.hostData);
      const disabledOverrides = await readDisabledOverrides(
        result.hostData.config.hostId,
        result.tabId,
        scope,
      );
      const hostData = includeDisabledAppsInCatalog(
        result.hostData,
        disabledOverrides,
      );

      lastActiveTabId.current = result.tabId;
      setSession({
        hostData,
        tabId: result.tabId,
        activeOverrides,
        disabledOverrides,
        scope,
      });
      setStatus('LOADED');
      setMessage(createHostWarningMessage(hostData));
    } catch (error) {
      if (lastActiveTabId.current)
        await updateActionBadge(lastActiveTabId.current, 0);
      setSession(undefined);
      setStatus('ERROR');
      setMessage(errorMessage(error));
    }
  }

  return (
    <PopupHostContext.Provider
      value={{
        hostData: session?.hostData,
        status,
        message,
        loadHost,
      }}
    >
      {children}
    </PopupHostContext.Provider>
  );
}

export function usePopupHost(): PopupHostContextValue {
  const value = useContext(PopupHostContext);
  if (!value)
    throw new Error('usePopupHost must be used within PopupHostProvider.');
  return value;
}
