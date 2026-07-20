import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  PopupHostProvider,
  PopupNavigationProvider,
  PopupOverridesProvider,
  PopupSessionProvider,
} from '../context';

export function PopupProvider({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PopupSessionProvider>
        <PopupHostProvider>
          <PopupOverridesProvider>
            <PopupNavigationProvider>{children}</PopupNavigationProvider>
          </PopupOverridesProvider>
        </PopupHostProvider>
      </PopupSessionProvider>
    </MemoryRouter>
  );
}
