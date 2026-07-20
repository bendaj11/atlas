import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from 'react';
import { errorMessage } from '../popup/atlas-host';
import {
  clearAllOverridesInSession,
  clearOverrideInSession,
  saveOverrideInSession,
  setOverrideScopeInSession,
  toggleOverrideInSession,
} from '../popup/override-session';
import { persistOverrideSession } from '../popup/persist-overrides';
import { usePopupSession } from './PopupSessionContext';
import { createArtifactViewModels } from '../popup/popup-view-models';
import type {
  AppViewModel,
  OverrideStatus,
  PopupSession,
  SaveOverrideValue,
  Scope,
} from '../popup/types';

interface PopupOverridesContextValue {
  apps: AppViewModel[];
  widgetProviders: AppViewModel[];
  host: AppViewModel | undefined;
  hasOverrides: boolean;
  scope: Scope;
  status: OverrideStatus;
  message: string;
  clearAllOverrides: () => Promise<void>;
  clearOverride: (key: string) => Promise<void>;
  reportError: (message: string) => void;
  saveOverride: (value: SaveOverrideValue) => void;
  setScope: (scope: Scope) => void;
  toggleOverride: (key: string) => Promise<void>;
}

const PopupOverridesContext = createContext<
  PopupOverridesContextValue | undefined
>(undefined);

export function PopupOverridesProvider({ children }: { children: ReactNode }) {
  const { session, setSession } = usePopupSession();
  const [status, setStatus] = useState<OverrideStatus>('IDLE');
  const [message, setMessage] = useState('');
  const applying = useRef(false);

  async function persistOverrides(nextSession: PopupSession): Promise<void> {
    if (applying.current) return;

    applying.current = true;
    setStatus('APPLYING');
    setMessage('Applying overrides...');

    try {
      await persistOverrideSession(nextSession);
      setStatus('IDLE');
      setMessage('');
      window.close();
    } catch (error) {
      setStatus('ERROR');
      setMessage(errorMessage(error));
    } finally {
      applying.current = false;
    }
  }

  async function toggleOverride(key: string): Promise<void> {
    if (!session || applying.current) return;
    const nextSession = toggleOverrideInSession(session, key);
    if (!nextSession) return;
    setSession(nextSession);
    await persistOverrides(nextSession);
  }

  function saveOverride(value: SaveOverrideValue): void {
    if (!session || applying.current) return;
    const nextSession = saveOverrideInSession(session, value);
    setSession(nextSession);
    void persistOverrides(nextSession);
  }

  async function clearAllOverrides(): Promise<void> {
    if (!session || applying.current) return;
    const nextSession = clearAllOverridesInSession(session);
    setSession(nextSession);
    await persistOverrides(nextSession);
  }

  async function clearOverride(key: string): Promise<void> {
    if (!session || applying.current) return;
    const nextSession = clearOverrideInSession(session, key);
    setSession(nextSession);
    await persistOverrides(nextSession);
  }

  function setScope(scope: Scope): void {
    setSession((current) =>
      current ? setOverrideScopeInSession(current, scope) : current,
    );
  }

  function reportError(errorMessage: string): void {
    setStatus('ERROR');
    setMessage(errorMessage);
  }

  const activeOverrides = session?.activeOverrides ?? new Map();
  const disabledOverrides = session?.disabledOverrides ?? new Map();
  const apps = createArtifactViewModels(
    session?.hostData.catalog.apps ?? [],
    activeOverrides,
    disabledOverrides,
  );
  const widgetProviders = createArtifactViewModels(
    session?.hostData.catalog.widgetProviders ?? [],
    activeOverrides,
    disabledOverrides,
  );
  const host = session
    ? createArtifactViewModels(
        [session.hostData.catalog.host],
        activeOverrides,
        disabledOverrides,
      )[0]
    : undefined;

  return (
    <PopupOverridesContext.Provider
      value={{
        apps,
        widgetProviders,
        host,
        hasOverrides: activeOverrides.size > 0 || disabledOverrides.size > 0,
        scope: session?.scope ?? 'all',
        status,
        message,
        clearAllOverrides,
        clearOverride,
        reportError,
        saveOverride,
        setScope,
        toggleOverride,
      }}
    >
      {children}
    </PopupOverridesContext.Provider>
  );
}

export function usePopupOverrides(): PopupOverridesContextValue {
  const value = useContext(PopupOverridesContext);
  if (!value)
    throw new Error(
      'usePopupOverrides must be used within PopupOverridesProvider.',
    );
  return value;
}
