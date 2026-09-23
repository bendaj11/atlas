import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from 'react';
import { updateAtlasHostData, type AtlasHostData } from '@atlas/sdk';
import { AtlasSdkProvider, createHostNavigation } from '@atlas/sdk/react';
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
} from './react.types.js';

export type {
  AtlasHostProviderProps,
  HostOptions,
  HostSdkOptions,
} from './react.types.js';

const AtlasHostAnchorsContext = createContext<
  AtlasHostAnchorRegistry | undefined
>(undefined);

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

/** Boots Atlas discovery, Native Federation, routing, slots, and lifecycle for a React host. */
export async function startHost<THostSdk extends object = {}>(
  options: HostOptions<THostSdk>,
): Promise<AtlasHostRuntime<THostSdk>> {
  return startDomHost(options, {
    createNavigation: () =>
      options.navigation ?? createHostNavigation(options.router),
  });
}

/** Provides one host-owned SDK and starts Atlas after the host tree commits. */
export function AtlasHostProvider<THostSdk extends object = {}>(
  props: AtlasHostProviderProps<THostSdk>,
): ReactElement {
  const [{ options, sdk, anchors }] = useState(() =>
    createHostProviderState(props),
  );

  useEffect(() => {
    let active = true;
    let runtime: AtlasHostRuntime | undefined;

    void Promise.resolve().then(async () => {
      if (!active) return;

      try {
        runtime = await startHost(options);

        if (!active) await runtime.stop();
      } catch {
        return;
      }
    });

    return () => {
      active = false;

      if (runtime) void runtime.stop();
    };
  }, [options]);

  useEffect(() => {
    updateAtlasHostData(sdk, pickCustomHostData(props.options.hostData));
  }, [props.options.hostData, sdk]);

  return createElement(AtlasHostAnchorsContext.Provider, {
    value: anchors,
    children: createElement(AtlasSdkProvider, {
      sdk,
      children: props.children,
    }),
  });
}

function createHostProviderState<THostSdk extends object>(
  props: AtlasHostProviderProps<THostSdk>,
): HostProviderState<THostSdk> {
  const { hostId, options: hostOptions } = props;
  const navigation =
    hostOptions.navigation ?? createHostNavigation(hostOptions.router);
  const sdk = createDomHostSdk({ options: hostOptions, hostId, navigation });
  const anchors = new AtlasHostAnchorRegistry();

  return {
    options: { ...hostOptions, navigation, sdk, anchors },
    sdk,
    anchors,
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
  return useRegisteredHostAnchor('route-outlet');
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
