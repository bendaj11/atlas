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
import type {
  ArtifactSelection,
  OverrideStatus,
  PopupSession,
  Scope,
} from '../popup/types';

interface PopupOverridesContextValue {
  hasOverrides: boolean;
  scope: Scope;
  status: OverrideStatus;
  message: string;
  clearAllOverrides: () => Promise<void>;
  clearOverride: (artifactKey: string) => Promise<void>;
  reportError: (message: string) => void;
  saveOverride: (selection: ArtifactSelection) => void;
  setScope: (scope: Scope) => void;
  toggleOverride: (artifactKey: string) => Promise<void>;
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

  async function toggleOverride(artifactKey: string): Promise<void> {
    if (!session || applying.current) return;
    const nextSession = toggleOverrideInSession({ session, artifactKey });
    if (!nextSession) return;
    setSession(nextSession);
    await persistOverrides(nextSession);
  }

  function saveOverride(selection: ArtifactSelection): void {
    if (!session || applying.current) return;
    const nextSession = saveOverrideInSession({ session, selection });
    setSession(nextSession);
    void persistOverrides(nextSession);
  }

  async function clearAllOverrides(): Promise<void> {
    if (!session || applying.current) return;
    const nextSession = clearAllOverridesInSession(session);
    setSession(nextSession);
    await persistOverrides(nextSession);
  }

  async function clearOverride(artifactKey: string): Promise<void> {
    if (!session || applying.current) return;
    const nextSession = clearOverrideInSession({ session, artifactKey });
    setSession(nextSession);
    await persistOverrides(nextSession);
  }

  function setScope(scope: Scope): void {
    setSession((current) =>
      current
        ? setOverrideScopeInSession({ session: current, scope })
        : current,
    );
  }

  function reportError(errorMessage: string): void {
    setStatus('ERROR');
    setMessage(errorMessage);
  }

  const activeOverrides = session?.activeOverrides ?? new Map();
  const disabledOverrides = session?.disabledOverrides ?? new Map();
  return (
    <PopupOverridesContext.Provider
      value={{
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
