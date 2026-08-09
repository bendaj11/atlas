import {
  createContext,
  createElement,
  Fragment,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react';
import { updateAtlasHostData, type AtlasHostDataOf } from '@atlas/sdk';
import {
  AtlasSdkProvider,
  createHostNavigation,
  type RouterLike,
} from '@atlas/sdk/react';
import { startDomHost, type DomHostOptions } from './dom-host.js';
import type { DomRuntimeOptions } from './dom-host-options.js';
import { createDomHostSdk } from './dom-host-sdk.js';
import {
  readAtlasNavigationItems,
  subscribeAtlasNavigationItems,
  type AtlasHostNavigationItem,
  type AtlasHostRuntime,
} from './index.js';
import {
  AtlasHostAnchorRegistry,
  type AtlasHostAnchorKind,
} from './host-anchors.js';

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

export type HostOptions<THostSdk extends object = {}> =
  DomHostOptions<THostSdk> & {
    router: RouterLike;
  };

/** Product SDK configuration supplied to a React Atlas host. */
export type HostSdkOptions<THostSdk extends object = {}> = Omit<
  HostOptions<THostSdk>,
  keyof DomRuntimeOptions | 'router' | 'navigation' | 'sdk'
> &
  Pick<HostOptions<THostSdk>, 'observe'>;

export interface AtlasHostProviderProps<THostSdk extends object = {}> {
  children: ReactNode;
  hostId: string;
  options: HostOptions<THostSdk>;
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
    createProviderState(props),
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
        // startDomHost already renders and reports one structured browser error.
      }
    });

    return () => {
      active = false;
      if (runtime) void runtime.stop();
    };
  }, [options]);

  useEffect(() => {
    const updates = readCustomHostData(props.options.hostData);
    updateAtlasHostData(sdk, updates as Partial<AtlasHostDataOf<THostSdk>>);
  }, [props.options.hostData, sdk]);

  return createElement(AtlasHostAnchorsContext.Provider, {
    value: anchors,
    children: createElement(AtlasSdkProvider, {
      sdk,
      children: props.children,
    }),
  });
}

function createProviderState<THostSdk extends object>(
  props: AtlasHostProviderProps<THostSdk>,
): {
  options: HostOptions<THostSdk>;
  sdk: ReturnType<typeof createDomHostSdk<THostSdk>>;
  anchors: AtlasHostAnchorRegistry;
} {
  const { hostId, options: hostOptions } = props;
  const navigation =
    hostOptions.navigation ?? createHostNavigation(hostOptions.router);
  const sdk = createDomHostSdk(hostOptions, hostId, navigation);
  const anchors = new AtlasHostAnchorRegistry();
  return {
    options: { ...hostOptions, navigation, sdk, anchors },
    sdk,
    anchors,
  };
}

function readCustomHostData(hostData: object | undefined): object {
  if (!hostData) return {};
  const {
    hostId: _hostId,
    name: _name,
    ...updates
  } = hostData as {
    hostId?: unknown;
    name?: unknown;
  };
  return updates;
}

export function AtlasHostStatus(): ReactElement {
  return useHostAnchor('status');
}
export function AtlasNavigation(props: {
  'aria-label'?: string;
}): ReactElement {
  return useHostAnchor('navigation', undefined, props);
}
export function AtlasRouteOutlet(): ReactElement {
  return useHostAnchor('route-outlet');
}

/** Renders host layout content only while Atlas activates its layout id. */
export function AtlasHostLayout(props: {
  layoutId: string;
  children?: ReactNode;
}): ReactElement | null {
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

export function AtlasSlot(props: { slotId: string }): ReactElement {
  return useHostAnchor('slot', props.slotId);
}

function useHostAnchor(
  kind: AtlasHostAnchorKind,
  name?: string,
  props?: Record<string, string | undefined>,
): ReactElement {
  const anchors = useAtlasHostAnchors();
  const [element, setElement] = useState<HTMLElement | null>(null);
  useEffect(
    () => (element ? anchors.register(kind, element, name) : undefined),
    [anchors, element, kind, name],
  );
  return createElement(anchorTag(kind), { ...props, ref: setElement });
}

function useAtlasHostAnchors(): AtlasHostAnchorRegistry {
  const anchors = useContext(AtlasHostAnchorsContext);
  if (!anchors)
    throw new Error(
      'Atlas host anchors must be rendered inside AtlasHostProvider.',
    );
  return anchors;
}

function anchorTag(kind: AtlasHostAnchorKind): string {
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
