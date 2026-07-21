import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  PopupHostProvider,
  PopupOverridesProvider,
  PopupSessionProvider,
} from '../context';
import { WixDesignSystemProvider } from '@wix/design-system';

export function PopupProvider({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <PopupSessionProvider>
        <PopupHostProvider>
          <PopupOverridesProvider>
            <WixDesignSystemProvider>{children}</WixDesignSystemProvider>
          </PopupOverridesProvider>
        </PopupHostProvider>
      </PopupSessionProvider>
    </MemoryRouter>
  );
}
