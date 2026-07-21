import { createContext, type ReactNode, useContext, useState } from 'react';
import type { AtlasHostData as HostData } from '../contracts';
import {
  errorMessage,
  readDisabledOverrides,
  readHostData,
} from '../popup/atlas-host';
import { readHostDataCache } from '../popup/host-data-cache';
import {
  extractActiveOverrideManifests,
  includeDisabledAppsInCatalog,
} from '../popup/override-manifests';
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
    }
  | {
      status: 'ERROR';
      message: string;
    };

async function createLoadedHost(
  result: Awaited<ReturnType<typeof readHostData>>,
): Promise<HostLoadResult> {
  const scope = result.hostData.overrideScope === 'tab' ? 'tab' : 'all';
  const activeOverrides = extractActiveOverrideManifests(result.hostData);
  const disabledOverrides = await readDisabledOverrides({
    hostId: result.hostData.config.hostId,
    tabId: result.tabId,
    scope,
  });
  const hostData = includeDisabledAppsInCatalog({
    hostData: result.hostData,
    disabledOverrides,
  });

  return {
    status: 'LOADED',
    session: {
      hostData,
      tabId: result.tabId,
      activeOverrides,
      disabledOverrides,
      scope,
    },
  };
}

async function loadCachedPopupHost(): Promise<HostLoadResult | undefined> {
  try {
    const cached = await readHostDataCache();
    return cached ? createLoadedHost(cached) : undefined;
  } catch {
    return undefined;
  }
}

async function loadPopupHost(): Promise<HostLoadResult> {
  try {
    const result = await readHostData();
    return createLoadedHost(result);
  } catch (error) {
    return { status: 'ERROR', message: errorMessage(error) };
  }
}

export function PopupHostProvider({ children }: { children: ReactNode }) {
  const { session, setSession } = usePopupSession();
  const [status, setStatus] = useState<HostStatus>('RESTORING');
  const [message, setMessage] = useState('Reading active Atlas host...');

  async function loadHost(): Promise<void> {
    if (!session) {
      const cached = await loadCachedPopupHost();
      if (cached?.status === 'LOADED') {
        setSession(cached.session);
        setStatus(cached.status);
        setMessage('');
        return;
      }
    }

    setStatus('LOADING');
    setMessage('Reading active Atlas host...');

    const result = await loadPopupHost();
    if (result.status === 'LOADED') {
      setSession(result.session);
      setStatus(result.status);
      setMessage('');
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
