import 'es-module-shims';
import { StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { initFederation, loadRemoteModule } from '@atlas/sdk/federation';
import type { AtlasHostClientEntry } from '@atlas/sdk/lifecycle';
import {
  AtlasHostProvider,
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/react';
import atlasConfig from '../atlas.config';
import './styles.css';

type HostMountRequest = Parameters<AtlasHostClientEntry['mount']>[0];

function HostLayout() {
  return (
    <AtlasHostLayout layoutId="default">
      <AtlasHostStatus />
      <header>
        <strong>Atlas</strong>
        <AtlasSlot slotId="header" />
      </header>
      <AtlasNavigation aria-label="Application" />
      <AtlasRouteOutlet />
    </AtlasHostLayout>
  );
}

function mountHost(request: HostMountRequest) {
  const router = createBrowserRouter([{ path: '*', Component: HostLayout }]);
  const element = (
    <StrictMode>
      <AtlasHostProvider
        hostId={atlasConfig.id}
        options={{
          router,
          federation: { initFederation, loadRemoteModule },
          hostData: { hostId: atlasConfig.id, name: atlasConfig.name },
          runtimeConfig: request.runtimeConfig,
          ...(request.catalog ? { catalog: request.catalog } : {}),
        }}
      >
        <RouterProvider router={router} />
      </AtlasHostProvider>
    </StrictMode>
  );
  const root = createRoot(request.container);
  flushSync(() => root.render(element));
  return { unmount: () => root.unmount() };
}

export const mount: AtlasHostClientEntry['mount'] = mountHost;
