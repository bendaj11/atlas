import {
  createContext,
  type ReactNode,
  useContext,
  useState,
} from 'react';
import type { AtlasHostData as HostData } from '../contracts';
import {
  errorMessage,
  readDisabledOverrides,
  readHostData,
} from '../popup/atlas-host';
import {
  extractActiveOverrideManifests,
  includeDisabledAppsInCatalog,
} from '../popup/override-manifests';
import { createHostWarningMessage } from '../popup/host-warning';
import type { HostStatus, PopupSession } from '../popup/types';
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

type HostLoadResult =
  | {
      status: 'LOADED';
      session: PopupSession;
      message: string;
    }
  | {
      status: 'ERROR';
      message: string;
    };

async function loadPopupHost(): Promise<HostLoadResult> {
  try {
    const result = await readHostData();
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

    return {
      status: 'LOADED',
      session: {
        hostData,
        tabId: result.tabId,
        activeOverrides,
        disabledOverrides,
        scope,
      },
      message: createHostWarningMessage(hostData),
    };
  } catch (error) {
    return { status: 'ERROR', message: errorMessage(error) };
  }
}

export function PopupHostProvider({ children }: { children: ReactNode }) {
  const { session, setSession } = usePopupSession();
  const [status, setStatus] = useState<HostStatus>('LOADING');
  const [message, setMessage] = useState('Reading active Atlas host...');

  async function loadHost(): Promise<void> {
    setStatus('LOADING');
    setMessage('Reading active Atlas host...');

    const result = await loadPopupHost();
    if (result.status === 'LOADED') {
      setSession(result.session);
      setStatus(result.status);
      setMessage(result.message);
      return;
    }

    setSession(undefined);
    setStatus(result.status);
    setMessage(result.message);
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
