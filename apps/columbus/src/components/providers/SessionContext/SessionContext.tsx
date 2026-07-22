import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react';
import type { ExtensionSession } from '../../../types/app.js';

interface SessionContextValue {
  session: ExtensionSession | undefined;
  setSession: Dispatch<SetStateAction<ExtensionSession | undefined>>;
}

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ExtensionSession>();

  return (
    <SessionContext.Provider value={{ session, setSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value)
    throw new Error('useSession must be used within SessionProvider.');
  return value;
}
