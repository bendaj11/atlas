import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from 'react';
import type { PopupSession } from '../popup/types';

interface PopupSessionContextValue {
  session: PopupSession | undefined;
  setSession: Dispatch<SetStateAction<PopupSession | undefined>>;
}

const PopupSessionContext = createContext<PopupSessionContextValue | undefined>(
  undefined,
);

export function PopupSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PopupSession>();

  return (
    <PopupSessionContext.Provider value={{ session, setSession }}>
      {children}
    </PopupSessionContext.Provider>
  );
}

export function usePopupSession(): PopupSessionContextValue {
  const value = useContext(PopupSessionContext);
  if (!value)
    throw new Error(
      'usePopupSession must be used within PopupSessionProvider.',
    );
  return value;
}
