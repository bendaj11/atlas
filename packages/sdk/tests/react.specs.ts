import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import {
  connectRouter,
  createRouterOptions,
  defineApp,
  createHostNavigation,
} from '../dist/react.js';
import type { RouterLike } from '../dist/react-router.js';
import { createTestHostSdk } from '../../testkit/dist/index.js';
import {
  generateHostFiles,
  generateAppFiles,
  generateWidgetFiles,
} from '../../generators/dist/index.js';
import { createAppContext, files, splitUrl } from './react.driver.js';

test('React generator emits React 19 Vite Native Federation projects', () => {
  const host = files(generateHostFiles({ name: 'host', framework: 'react' }));
  const customerHost = files(
    generateHostFiles({ name: 'customer-host', framework: 'react' }),
  );
  const numericHost = files(
    generateHostFiles({ name: '123-host', framework: 'react' }),
  );
  const appFiles = files(
    generateAppFiles({ name: 'orders', framework: 'react' }),
  );
  assert.equal(JSON.parse(host.get('package.json')).name, 'host');
  assert.equal(JSON.parse(appFiles.get('package.json')).name, 'orders');
  assert.equal(
    JSON.parse(
      files(
        generateHostFiles({
          name: 'host',
          packageName: '@acme/host',
          framework: 'react',
        }),
      ).get('package.json'),
    ).name,
    '@acme/host',
  );
  assert.match(host.get('package.json'), /"react": "\^19\.2\.0"/);
  assert.match(host.get('src/main.tsx'), /<HostAtlasProvider>/);
  assert.match(host.get('atlas.bootstrap.html'), /<title>Host<\/title>/);
  assert.match(
    host.get('atlas.bootstrap.html'),
    /id="atlas-host-root">Loading product…<\/div>/,
  );
  assert.match(host.get('atlas.bootstrap.html'), /src="\/atlas\.loader\.js"/);
  assert.equal(appFiles.has('atlas.bootstrap.html'), false);
  assert.doesNotMatch(
    host.get('src/main.tsx'),
    /startHost|createBrowserRouter|atlasConfig/,
  );
  assert.equal(host.has('src/atlas-bootstrap.ts'), false);
  assert.match(
    host.get('src/HostAtlasProvider.tsx'),
    /import \{ HostLayout \} from "\.\/app\/HostLayout"/,
  );
  assert.match(host.get('src/HostAtlasProvider.tsx'), /Component: HostLayout/);
  assert.match(host.get('src/HostAtlasProvider.tsx'), /createBrowserRouter/);
  assert.match(host.get('src/HostAtlasProvider.tsx'), /AtlasHostProvider/);
  assert.match(host.get('src/app/HostLayout.tsx'), /data-atlas-host-status/);
  assert.match(host.get('src/app/HostLayout.tsx'), /data-atlas-slot="header"/);
  assert.match(host.get('src/app/HostLayout.tsx'), /data-atlas-navigation/);
  assert.match(host.get('src/app/HostLayout.tsx'), /data-atlas-route-outlet/);
  assert.match(
    host.get('src/HostAtlasProvider.tsx'),
    /from "@atlas\/sdk\/federation"/,
  );
  assert.doesNotMatch(
    host.get('src/HostAtlasProvider.tsx'),
    /@softarc\/native-federation-runtime/,
  );
  assert.match(
    host.get('src/HostAtlasProvider.tsx'),
    /export function HostAtlasProvider/,
  );
  assert.equal(customerHost.has('src/CustomerHostAtlasProvider.tsx'), true);
  assert.match(customerHost.get('src/main.tsx'), /<CustomerHostAtlasProvider>/);
  assert.equal(numericHost.has('src/Host123HostAtlasProvider.tsx'), true);
  assert.match(
    host.get('src/HostAtlasProvider.tsx'),
    /import atlasConfig from "\.\.\/atlas\.config"/,
  );
  assert.equal(host.has('tsconfig.atlas.json'), false);
  assert.equal(appFiles.has('tsconfig.atlas.json'), false);
  assert.deepEqual(JSON.parse(host.get('tsconfig.json')).include, [
    'src',
    'vite.config.ts',
    'atlas.config.ts',
  ]);
  assert.deepEqual(JSON.parse(appFiles.get('tsconfig.json')).include, [
    'src',
    'vite.config.ts',
    'atlas.config.ts',
  ]);
  assert.match(
    host.get('src/HostAtlasProvider.tsx'),
    /hostData: \{ hostId: atlasConfig\.id, name: atlasConfig\.name \}/,
  );
  assert.doesNotMatch(
    host.get('src/HostAtlasProvider.tsx'),
    /showToast|openModal|openPopup|createDomOverlayProviders/,
  );
  assert.doesNotMatch(
    host.get('src/main.tsx'),
    /const hostData: AtlasHostData/,
  );
  assert.doesNotMatch(host.get('src/main.tsx'), /projectId/);
  assert.doesNotMatch(host.get('src/main.tsx'), /data-atlas-host-status/);
  assert.doesNotMatch(
    host.get('src/main.tsx'),
    /function AtlasDefaultHostLayout/,
  );
  assert.match(host.get('vite.config.ts'), /createReactHostViteConfig/);
  assert.match(host.get('vite.config.ts'), /plugins: \[react\(\{\}\)\]/);
  assert.doesNotMatch(
    host.get('vite.config.ts'),
    /babel|reactCompilerPreset|ReactBabelOptions/,
  );
  assert.match(host.get('index.html'), /"shimMode": true/);
  assert.match(host.get('index.html'), /<head>\n    <meta charset="UTF-8">/);
  assert.equal(host.has('public/atlas.runtime.json'), false);
  assert.doesNotMatch(
    host.get('atlas.config.ts'),
    /allowCustomOverrides|resourcesTimeoutMs|resourcesRetryCount/,
  );
  assert.equal(host.has('Containerfile'), false);
  assert.doesNotMatch(host.get('package.json'), /"@atlas\/bootstrap"/);
  assert.match(
    host.get('src/host.tsx'),
    /export const mount: AtlasHostClientEntry/,
  );
  assert.doesNotMatch(
    host.get('vite.config.ts'),
    /remoteEntry\.json|closeBundle|rollupOptions/,
  );
  assert.doesNotMatch(host.get('package.json'), /runtime-config/);
  assert.match(
    host.get('package.json'),
    /atlas publish host --from-build-output/,
  );
  assert.match(
    host.get('package.json'),
    /atlas build-bootstrap host --skip-compile/,
  );
  assert.match(appFiles.get('vite.config.ts'), /createReactAppViteConfig/);
  assert.doesNotMatch(
    appFiles.get('vite.config.ts'),
    /remoteEntry\.json|handleHotUpdate|rollupOptions/,
  );
  assert.doesNotMatch(
    appFiles.get('package.json'),
    /@softarc\/native-federation-runtime/,
  );
  assert.match(
    appFiles.get('vite.config.ts'),
    /server: \{ port: 4201, cors: true \}/,
  );
  assert.match(appFiles.get('vite.config.ts'), /plugins: \[react\(\{\}\)\]/);
  assert.doesNotMatch(
    appFiles.get('vite.config.ts'),
    /babel|reactCompilerPreset/,
  );
  assert.doesNotMatch(appFiles.get('src/app/App.tsx'), /showToast|toast\.open/);
  assert.match(
    appFiles.get('src/app/routes.tsx'),
    /export const routes: RouteObject\[\]/,
  );
  assert.match(appFiles.get('src/app/App.tsx'), /<Outlet \/>/);
  assert.equal(appFiles.has('src/main.tsx'), false);
  assert.doesNotMatch(appFiles.get('index.html'), /src\/main\.tsx|id="root"/);
  assert.match(
    appFiles.get('src/app/routes.tsx'),
    /import \{ App \} from "\.\/App"/,
  );
  assert.match(appFiles.get('src/entry.tsx'), /createMemoryRouter/);
  assert.match(appFiles.get('src/entry.tsx'), /createRoutedApp/);
  assert.match(appFiles.get('src/entry.tsx'), /RouterProvider/);
  assert.match(appFiles.get('src/entry.tsx'), /createRoot/);
  assert.match(
    appFiles.get('src/entry.tsx'),
    /import \{ routes \} from "\.\/app\/routes"/,
  );
  assert.doesNotMatch(appFiles.get('src/entry.tsx'), /await import/);
  assert.doesNotMatch(
    appFiles.get('src/entry.tsx'),
    /useAtlasSdk|<Outlet|<Link|function Layout/,
  );
  assert.match(host.get('atlas.config.ts'), /AtlasHostConfig/);
  assert.match(appFiles.get('atlas.config.ts'), /AtlasAppConfig/);
  assert.doesNotMatch(appFiles.get('atlas.config.ts'), /hostCompatibility/);
  assert.doesNotMatch(appFiles.get('atlas.config.ts'), /placements/);
  assert.doesNotMatch(appFiles.get('atlas.config.ts'), /mounts/);
  assert.doesNotMatch(appFiles.get('atlas.config.ts'), /"host"/);
});

test('React Router app bridge synchronizes native and host navigation', async () => {
  const atlas = createAppContext('/catalog/products?tab=open');
  const listeners = new Set<() => void>();
  const router: RouterLike = {
    state: {
      location: { pathname: '/products', search: '?tab=open', hash: '' },
      historyAction: 'POP',
    },
    navigate(to, options) {
      if (typeof to !== 'string')
        throw new Error('Numeric navigation not used.');
      this.state.location = splitUrl(to);
      this.state.historyAction = options?.replace ? 'REPLACE' : 'PUSH';
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  assert.deepEqual(createRouterOptions(atlas.context), {
    initialEntries: ['/products?tab=open'],
  });
  const disconnect = connectRouter(router, atlas.context);
  router.navigate('/details/42', {});
  assert.equal(atlas.url(), '/catalog/details/42');
  atlas.hostNavigate('/catalog/settings?mode=compact');
  await Promise.resolve();
  assert.deepEqual(router.state.location, {
    pathname: '/settings',
    search: '?mode=compact',
    hash: '',
  });
  disconnect();
});

test('React generator targets selected supported majors without owning compiler setup', () => {
  const react17Host = files(
    generateHostFiles({
      name: 'oldest-host',
      framework: 'react',
      frameworkVersion: '^17.0.2',
    }),
  );
  const react17 = files(
    generateAppFiles({
      name: 'oldest',
      framework: 'react',
      frameworkVersion: '^17.0.2',
    }),
  );
  const react17Widget = files(
    generateWidgetFiles({
      name: 'oldest-widget',
      framework: 'react',
      frameworkVersion: '^17.0.2',
    }),
  );
  const react18 = files(
    generateAppFiles({
      name: 'legacy',
      framework: 'react',
      frameworkVersion: '^18.3.0',
    }),
  );
  const react19 = files(
    generateAppFiles({
      name: 'current',
      framework: 'react',
      frameworkVersion: '^19.2.0',
    }),
  );
  assert.doesNotMatch(react17.get('package.json'), /react-compiler-runtime/);
  assert.match(react17.get('package.json'), /"react-router-dom": "\^6\.30\.1"/);
  assert.doesNotMatch(react17.get('package.json'), /"react-router": "\^7/);
  assert.match(
    react17Host.get('src/main.tsx'),
    /import \{ render \} from "react-dom"/,
  );
  assert.doesNotMatch(
    react17Host.get('src/main.tsx'),
    /unmountComponentAtNode/,
  );
  assert.doesNotMatch(react17Host.get('src/main.tsx'), /react-dom\/client/);
  assert.match(
    react17.get('src/entry.tsx'),
    /function createRoot\(container: Element\)/,
  );
  assert.doesNotMatch(react17.get('src/entry.tsx'), /react-dom\/client/);
  assert.doesNotMatch(
    react17Widget.get('src/exported-widgets/oldest-widget/index.tsx'),
    /unmountComponentAtNode|defineExportedWidget|createRoot/,
  );
  assert.match(
    react17.get('vite.config.ts'),
    /createReactAppViteConfig\(\{ projectRoot: __dirname, projectName: "oldest", reactMajor: 17 \}\)/,
  );
  assert.match(react18.get('package.json'), /"react": "\^18\.3\.0"/);
  assert.doesNotMatch(react18.get('package.json'), /react-compiler-runtime/);
  assert.doesNotMatch(
    react19.get('package.json'),
    /babel-plugin-react-compiler/,
  );
  assert.match(
    react19.get('package.json'),
    /"@vitejs\/plugin-react": "\^5\.0\.4"/,
  );
  assert.doesNotMatch(
    react19.get('package.json'),
    /@rolldown\/plugin-babel|"rolldown"/,
  );
  assert.match(react19.get('package.json'), /"vite": "\^7\.3\.6"/);
  assert.doesNotMatch(react19.get('package.json'), /"react-compiler-runtime"/);
  assert.doesNotMatch(react19.get('package.json'), /"latest"/);
  assert.match(react18.get('vite.config.ts'), /reactMajor: 18/);
  assert.throws(
    () =>
      generateHostFiles({
        name: 'future',
        framework: 'react',
        frameworkVersion: '^20.0.0',
      }),
    /not verified/,
  );
  assert.doesNotThrow(() =>
    generateHostFiles({
      name: 'future',
      framework: 'react',
      frameworkVersion: '^20.0.0',
      allowUnsupportedVersion: true,
    }),
  );
});

test('React generator rejects unsafe project, widget, and host IDs', () => {
  assert.throws(
    () => generateHostFiles({ name: '../host', framework: 'react' }),
    /Invalid generator name/,
  );
  assert.throws(
    () => generateAppFiles({ name: 'Orders', framework: 'react' }),
    /Invalid generator name/,
  );
  assert.throws(
    () => generateWidgetFiles({ name: 'summary/widget', framework: 'react' }),
    /Invalid generator name/,
  );
  assert.throws(
    () =>
      generateAppFiles({
        name: 'orders',
        framework: 'react',
        hostId: 'host"], routes: []',
      }),
    /Invalid generator hostId/,
  );
});

test('React generator targets a supplied compatible host and keeps framework dependencies isolated', () => {
  const appFiles = files(
    generateAppFiles({
      name: 'orders',
      framework: 'react',
      hostId: 'customer-host',
    }),
  );
  assert.doesNotMatch(appFiles.get('atlas.config.ts'), /hostCompatibility/);
  assert.match(appFiles.get('atlas.config.ts'), /routes: \[/);
  assert.match(appFiles.get('atlas.config.ts'), /hostId: "customer-host"/);
  assert.match(appFiles.get('vite.config.ts'), /createReactAppViteConfig/);
  assert.doesNotMatch(appFiles.get('atlas.config.ts'), /hostId: "host"/);
});

test('React widget generator creates a typed independently deployed widget', () => {
  const widget = files(
    generateWidgetFiles({ name: 'entity-popup', framework: 'react' }),
  );
  assert.match(
    widget.get('src/exported-widgets/entity-popup/atlas.config.ts'),
    /id: "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"/,
  );
  assert.match(
    widget.get('src/exported-widgets/entity-popup/index.tsx'),
    /EntityPopupWidgetProps/,
  );
  assert.match(
    widget.get('src/exported-widgets/entity-popup/index.tsx'),
    /export default function EntityPopupWidget/,
  );
  assert.doesNotMatch(
    widget.get('src/exported-widgets/entity-popup/index.tsx'),
    /defineExportedWidget|createRoot|createElement/,
  );
  assert.doesNotMatch(
    widget.get('src/exported-widgets/entity-popup/index.tsx'),
    /@vitejs\/plugin-react\/preamble/,
  );
  assert.doesNotMatch(
    widget.get('src/exported-widgets/entity-popup/index.tsx'),
    /await import/,
  );
});

test('React Router adapter owns navigation and subscriptions', async () => {
  const subscribers = new Set<() => void>();
  const calls: Array<
    [string | number, { replace?: boolean; state?: unknown } | undefined]
  > = [];
  const router: RouterLike = {
    state: { location: { pathname: '/orders', search: '?tab=open', hash: '' } },
    navigate(to, options) {
      calls.push([to, options]);
      if (typeof to === 'string') this.state.location.pathname = to;
      for (const listener of subscribers) listener();
    },
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
  };
  const navigation = createHostNavigation(router, 'https://host.example');
  const seen: string[] = [];
  const unsubscribe = navigation.subscribe((location) =>
    seen.push(location.pathname),
  );
  navigation.navigate('/orders/42');
  navigation.replace('/orders/43');
  navigation.back();
  unsubscribe();
  assert.deepEqual(
    calls.map(([to]) => to),
    ['/orders/42', '/orders/43', -1],
  );
  assert.equal(calls[1]?.[1]?.replace, true);
  assert.deepEqual(seen, ['/orders', '/orders/42', '/orders/43', '/orders/43']);
});

test('React app creates, renders, and unmounts one root', async () => {
  const calls: unknown[][] = [];
  const entry = defineApp({
    createRoot(container) {
      calls.push(['create', container]);
      return {
        render(element) {
          calls.push(['render', element]);
        },
        unmount() {
          calls.push(['unmount']);
        },
      };
    },
    createElement(request) {
      return request.context.basePath;
    },
  });
  const atlas = createAppContext('/catalog/orders');
  const container: HTMLElement = Object.create(null);
  const mounted = await entry.mount({
    container,
    sdk: createTestHostSdk(),
    context: atlas.context,
  });
  if (!mounted?.unmount)
    throw new Error('React app did not return an unmount lifecycle.');
  await mounted.unmount();
  assert.deepEqual(
    calls.map(([name]) => name),
    ['create', 'render', 'unmount'],
  );
});
