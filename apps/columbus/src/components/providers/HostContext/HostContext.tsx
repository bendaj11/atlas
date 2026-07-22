import { createContext, type ReactNode, useContext, useState } from 'react';
import type { AtlasHostData as HostData } from '../../../types/contracts.js';
import {
  errorMessage,
  readDisabledOverrides,
  readHostData,
} from '../../../scripts/host/atlas-host/atlas-host.js';
import { readHostDataCache } from '../../../scripts/host/host-data-cache.js';
import {
  extractActiveOverrideManifests,
  includeDisabledAppsInCatalog,
} from '../../../scripts/overrides/override-manifests.js';
import type { HostStatus, ExtensionSession } from '../../../types/app.js';
import { useSession } from '../SessionContext/SessionContext.js';

interface HostContextValue {
  hostData: HostData | undefined;
  status: HostStatus;
  message: string;
  loadHost: () => Promise<void>;
}

const HostContext = createContext<HostContextValue | undefined>(undefined);

type HostLoadResult =
  | {
      status: 'LOADED';
      session: ExtensionSession;
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

async function loadCachedHost(): Promise<HostLoadResult | undefined> {
  try {
    const cached = await readHostDataCache();
    return cached ? createLoadedHost(cached) : undefined;
  } catch {
    return undefined;
  }
}

async function readActiveHost(): Promise<HostLoadResult> {
  try {
    const result = await readHostData();
    return createLoadedHost(result);
  } catch (error) {
    return { status: 'ERROR', message: errorMessage(error) };
  }
}

export function HostProvider({ children }: { children: ReactNode }) {
  const { session, setSession } = useSession();
  const [status, setStatus] = useState<HostStatus>('RESTORING');
  const [message, setMessage] = useState('Reading active Atlas host...');

  async function loadHost(): Promise<void> {
    if (!session) {
      const cached = await loadCachedHost();
      if (cached?.status === 'LOADED') {
        setSession(cached.session);
        setStatus(cached.status);
        setMessage('');
        return;
      }
    }

    setStatus('LOADING');
    setMessage('Reading active Atlas host...');

    const result = await readActiveHost();
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
    <HostContext.Provider
      value={{
        hostData: session?.hostData,
        status,
        message,
        loadHost,
      }}
    >
      {children}
    </HostContext.Provider>
  );
}

export function useHost(): HostContextValue {
  const value = useContext(HostContext);
  if (!value) throw new Error('useHost must be used within HostProvider.');
  return value;
}
