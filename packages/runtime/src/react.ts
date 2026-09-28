import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type MouseEvent,
  type ReactElement,
} from 'react';
import { flushSync } from 'react-dom';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import {
  getAtlasNavigation,
  updateAtlasHostData,
  type AtlasHostData,
} from '@atlas/sdk';
import { initFederation, loadRemoteModule } from '@atlas/sdk/federation';
import type { AtlasHostClientEntry } from '@atlas/sdk/lifecycle';
import {
  AtlasSdkContext,
  AtlasSdkProvider,
  createHostNavigation,
} from '@atlas/sdk/react';
import { AtlasHostProviderMissingError } from './adapters/adapter.errors.js';
import { startDomHost } from './dom-host/dom-host.js';
import { createDomHostSdk } from './dom-host/dom-host-sdk.js';
import { AtlasHostAnchorRegistry } from './dom-host/host-anchors.js';
import type { AtlasHostAnchorKind } from './dom-host/host-anchors.types.js';
import {
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
} from './dom-host/host-navigation.js';
import type { AtlasHostNavigationItem } from './dom-host/host-navigation.types.js';
import type { AtlasHostRuntime } from './host-runtime/host-runtime.types.js';
import type {
  AtlasHostLayoutProps,
  AtlasHostProviderProps,
  AtlasNavigationProps,
  AtlasSlotProps,
  HostOptions,
  HostProviderState,
  ReactHostApplicationProps,
  ReactHostDefinition,
  ReactHostStartServices,
  RenderReactHostOptions,
} from './react.types.js';

export type {
  AtlasHostProviderProps,
  HostOptions,
  HostSdkOptions,
  LegacyReactDom,
  ReactDomClient,
  ReactDomRenderer,
  ReactDomRootOptions,
  ReactHostDefinition,
  ReactHostStartServices,
} from './react.types.js';

const AtlasHostAnchorsContext = createContext<
  AtlasHostAnchorRegistry | undefined
>(undefined);

const AtlasNotFoundContext = createContext<ComponentType>(AtlasDefaultNotFound);

export function AtlasDefaultHostLayout(): ReactElement {
  return createElement(
    AtlasHostLayout,
    { layoutId: 'default' },
    createElement(AtlasHostStatus),
    createElement(
      'header',
      null,
      createElement('strong', null, 'Atlas'),
      createElement(AtlasSlot, { slotId: 'header' }),
    ),
    createElement(AtlasNavigation, { 'aria-label': 'Application' }),
    createElement(AtlasRouteOutlet),
  );
}

export function defineReactHost<THostSdk extends object = {}>(
  definition: ReactHostDefinition<THostSdk>,
): AtlasHostClientEntry['mount'] {
  return (request) =>
    new Promise((resolve, reject) => {
      const root = document.createElement('atlas-host-root');
      root.hidden = true;

      request.container.append(root);

      const router = createBrowserRouter([
        { path: '*', Component: definition.layout },
      ]);
      const application = createElement(AtlasReactHostApplication<THostSdk>, {
        definition,
        request,
        router,
        onReady: () => {
          root.hidden = false;

          resolve({
            unmount: () => {
              unmount();
              root.remove();
            },
          });
        },
      });
      const element = definition.providers
        ? createElement(definition.providers, null, application)
        : application;
      const unmount = renderReactHost({
        reactDom: definition.reactDom,
        element,
        container: root,
        onUncaughtError: (error) => {
          console.error(error);
          reject(error);
        },
      });
    });
}

function AtlasReactHostApplication<THostSdk extends object>(
  props: ReactHostApplicationProps<THostSdk>,
): ReactElement {
  const { definition, request, router, onReady } = props;
  const { config, useSdkOptions } = definition;
  const sdkOptions = useSdkOptions();

  return createElement(AtlasHostProvider<THostSdk>, {
    hostId: config.id,
    ...(definition.notFound ? { notFound: definition.notFound } : {}),
    onReady,
    options: {
      ...sdkOptions,
      router,
      federation: { initFederation, loadRemoteModule },
      hostData: {
        ...sdkOptions.hostData,
        hostId: config.id,
        name: config.name ?? config.id,
      },
      runtimeConfig: request.runtimeConfig,
      hostContainer: request.container,
      ...(request.catalog ? { catalog: request.catalog } : {}),
    },
    children: createElement(RouterProvider, { router }),
  });
}

function renderReactHost(options: RenderReactHostOptions): () => void {
  const { reactDom, element, container, onUncaughtError } = options;

  if ('createRoot' in reactDom) {
    const root = reactDom.createRoot(container, { onUncaughtError });

    flushSync(() => root.render(element));

    return () => root.unmount();
  }

  reactDom.render(element, container);

  return () => {
    reactDom.unmountComponentAtNode(container);
  };
}

/** Boots Atlas discovery, Native Federation, routing, slots, and lifecycle for a React host. */
export async function startHost<THostSdk extends object = {}>(
  options: HostOptions<THostSdk>,
  services: ReactHostStartServices = {},
): Promise<AtlasHostRuntime<THostSdk>> {
  return startDomHost(options, {
    ...services,
    createNavigation: () =>
      options.navigation ?? createHostNavigation(options.router),
  });
}

/** Provides one host-owned SDK and starts Atlas after the host tree commits. */
export function AtlasHostProvider<THostSdk extends object = {}>(
  props: AtlasHostProviderProps<THostSdk>,
): ReactElement {
  const [{ options, sdk, anchors, services }] = useState(() =>
    createHostProviderState(props),
  );

  useEffect(() => {
    let active = true;
    let runtime: AtlasHostRuntime | undefined;

    void Promise.resolve().then(async () => {
      if (!active) return;

      try {
        runtime = await startHost(options, services);

        if (!active) await runtime.stop();
      } catch {
        return;
      }
    });

    return () => {
      active = false;

      if (runtime) void runtime.stop();
    };
  }, [options, services]);

  useEffect(() => {
    updateAtlasHostData(sdk, pickCustomHostData(props.options.hostData));
  }, [props.options.hostData, sdk]);

  const sdkChildren = createElement(AtlasSdkProvider, {
    sdk,
    children: props.children,
  });

  return createElement(AtlasHostAnchorsContext.Provider, {
    value: anchors,
    children: props.notFound
      ? createElement(AtlasNotFoundContext.Provider, {
          value: props.notFound,
          children: sdkChildren,
        })
      : sdkChildren,
  });
}

function createHostProviderState<THostSdk extends object>(
  props: AtlasHostProviderProps<THostSdk>,
): HostProviderState<THostSdk> {
  const { hostId, options: hostOptions, onReady } = props;
  const navigation =
    hostOptions.navigation ?? createHostNavigation(hostOptions.router);
  const sdk = createDomHostSdk({ options: hostOptions, hostId, navigation });
  const anchors = new AtlasHostAnchorRegistry();

  return {
    options: { ...hostOptions, navigation, sdk, anchors },
    sdk,
    anchors,
    services: onReady ? { onReady } : {},
  };
}

function pickCustomHostData(
  hostData: Partial<AtlasHostData> | undefined,
): Omit<Partial<AtlasHostData>, 'hostId' | 'name'> {
  if (!hostData) return {};

  const { hostId: _hostId, name: _name, ...updates } = hostData;

  return updates;
}

export function AtlasHostStatus(): ReactElement {
  return useRegisteredHostAnchor('status');
}

export function AtlasNavigation(props: AtlasNavigationProps): ReactElement {
  return useRegisteredHostAnchor('navigation', undefined, props);
}

export function AtlasRouteOutlet(): ReactElement {
  const anchors = useAtlasHostAnchors();
  const NotFound = useContext(AtlasNotFoundContext);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const routeNotFound = useSyncExternalStore(
    (listener) => anchors.subscribeRouteNotFound(listener),
    () => anchors.isRouteNotFound(),
    () => false,
  );

  useEffect(
    () => (element ? anchors.register('route-outlet', element) : undefined),
    [anchors, element],
  );

  return createElement(
    'atlas-route-outlet',
    null,
    createElement('div', { ref: setElement, style: { display: 'contents' } }),
    routeNotFound ? createElement(NotFound) : null,
  );
}

export function AtlasDefaultNotFound(): ReactElement {
  const sdk = useAtlasHostSdk();

  return createElement(
    'section',
    { 'data-atlas-not-found': '' },
    createElement('h1', null, 'Page not found'),
    createElement(
      'a',
      {
        href: '/',
        onClick: (event: MouseEvent) => {
          event.preventDefault();
          getAtlasNavigation(sdk).navigate('/');
        },
      },
      'Go to the home page',
    ),
  );
}

/** Renders host layout content only while Atlas activates its layout id. */
export function AtlasHostLayout(
  props: AtlasHostLayoutProps,
): ReactElement | null {
  const anchors = useAtlasHostAnchors();
  const activeLayoutId = useSyncExternalStore(
    (listener) => anchors.subscribeLayouts(listener),
    () => anchors.getActiveLayout(),
    () => undefined,
  );

  return activeLayoutId === props.layoutId
    ? createElement(Fragment, null, props.children)
    : null;
}

export function AtlasSlot(props: AtlasSlotProps): ReactElement {
  return useRegisteredHostAnchor('slot', props.slotId);
}

function useRegisteredHostAnchor(
  kind: AtlasHostAnchorKind,
  name?: string,
  props?: AtlasNavigationProps,
): ReactElement {
  const anchors = useAtlasHostAnchors();
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(
    () => (element ? anchors.register(kind, element, name) : undefined),
    [anchors, element, kind, name],
  );

  return createElement(getAnchorTagName(kind), { ...props, ref: setElement });
}

function useAtlasHostAnchors(): AtlasHostAnchorRegistry {
  const anchors = useContext(AtlasHostAnchorsContext);

  if (!anchors) throw new AtlasHostProviderMissingError();

  return anchors;
}

function useAtlasHostSdk(): object {
  const sdk = useContext(AtlasSdkContext);

  if (!sdk) throw new AtlasHostProviderMissingError();

  return sdk;
}

function getAnchorTagName(kind: AtlasHostAnchorKind): string {
  return `atlas-${kind}`;
}

export function useAtlasNavigationItems(
  document: Document = globalThis.document,
): readonly AtlasHostNavigationItem[] {
  const [items, setItems] = useState(() => readAtlasNavigationItems(document));

  useEffect(() => {
    setItems(readAtlasNavigationItems(document));

    return subscribeAtlasNavigationItems(setItems, document);
  }, [document]);

  return items;
}
