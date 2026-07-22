import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { HostProvider, OverridesProvider, SessionProvider } from '../index.js';
import { WixDesignSystemProvider } from '@wix/design-system';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <SessionProvider>
        <HostProvider>
          <OverridesProvider>
            <WixDesignSystemProvider>{children}</WixDesignSystemProvider>
          </OverridesProvider>
        </HostProvider>
      </SessionProvider>
    </MemoryRouter>
  );
}
