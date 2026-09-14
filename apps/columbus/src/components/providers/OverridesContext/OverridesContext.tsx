import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from 'react';
import { errorMessage } from '../../../scripts/host/atlas-host/atlas-host';
import {
  clearAllOverridesInSession,
  clearOverrideInSession,
  saveOverrideInSession,
  setOverrideScopeInSession,
  toggleOverrideInSession,
} from '../../../scripts/overrides/override-session/override-session';
import { persistOverrideSession } from '../../../scripts/overrides/persist-overrides';
import { useSession } from '../SessionContext/SessionContext';
import type {
  ArtifactSelection,
  OverrideStatus,
  ExtensionSession,
  Scope,
} from '../../../types/app';

interface OverridesContextValue {
  hasOverrides: boolean;
  scope: Scope;
  status: OverrideStatus;
  message: string;
  clearAllOverrides: () => Promise<void>;
  clearOverride: (artifactKey: string) => Promise<void>;
  reportError: (message: string) => void;
  saveOverride: (selection: ArtifactSelection) => Promise<void>;
  setScope: (scope: Scope) => void;
  toggleOverride: (artifactKey: string) => Promise<void>;
}

const OverridesContext = createContext<OverridesContextValue | undefined>(
  undefined,
);

export function OverridesProvider({ children }: { children: ReactNode }) {
  const { session, setSession } = useSession();
  const [status, setStatus] = useState<OverrideStatus>('IDLE');
  const [message, setMessage] = useState('');
  const applying = useRef(false);

  async function applyToSession(
    transform: (session: ExtensionSession) => ExtensionSession | undefined,
  ): Promise<void> {
    if (!session || applying.current) return;

    const nextSession = transform(session);
    if (!nextSession) return;

    setSession(nextSession);
    await persistOverrides(nextSession);
  }

  async function persistOverrides(
    nextSession: ExtensionSession,
  ): Promise<void> {
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
      setMessage(
        errorMessage(
          error,
          'apply the selected overrides',
          'Reload the Atlas host tab, reopen Columbus, verify the selected build is available, and retry.',
        ),
      );
    } finally {
      applying.current = false;
    }
  }

  function toggleOverride(artifactKey: string): Promise<void> {
    return applyToSession((current) =>
      toggleOverrideInSession({ session: current, artifactKey }),
    );
  }

  function saveOverride(selection: ArtifactSelection): Promise<void> {
    return applyToSession((current) =>
      saveOverrideInSession({ session: current, selection }),
    );
  }

  function clearAllOverrides(): Promise<void> {
    return applyToSession(clearAllOverridesInSession);
  }

  function clearOverride(artifactKey: string): Promise<void> {
    return applyToSession((current) =>
      clearOverrideInSession({ session: current, artifactKey }),
    );
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
    <OverridesContext.Provider
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
    </OverridesContext.Provider>
  );
}

export function useOverrides(): OverridesContextValue {
  const value = useContext(OverridesContext);
  if (!value)
    throw new Error('useOverrides must be used within OverridesProvider.');
  return value;
}
