import { useState, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { WixDesignSystemProvider } from '@wix/design-system';
import { createQueryClient } from '../../state/query-client/query-client';

export function AppProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <WixDesignSystemProvider>{children}</WixDesignSystemProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
