import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { act, render, type RenderResult } from '@testing-library/react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useAtlasSdk, type RouterNavigate } from '@atlas/sdk/react';
import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import type { AtlasAppMountResult } from '@atlas/sdk/lifecycle';
import {
  aHostRuntimeConfig,
  anAppManifest,
  aRoutePlacement,
} from '@atlas/testkit';
import type { AtlasHostRuntime } from './host-runtime/host-runtime.types.js';
import type {
  DomHostOptions,
  DomHostServices,
  RetryPlacementMount,
} from './dom-host/dom-host.types.js';
import { publishAtlasNavigationItems } from './dom-host/host-navigation.js';
import { aNavigationItem } from './dom-host/host-navigation.testkit.js';
import { aFederationAdapter } from './loader/native-federation.testkit.js';
import { installWebPlatformGlobals } from './shared/web-platform.testkit.js';
import type { AtlasErrorProps } from './react.types.js';

interface HostSdk {
  readonly hostData: { readonly region: string };
}

type StartDomHostForHostSdk = (
  options: DomHostOptions<HostSdk>,
  services: DomHostServices<HostSdk>,
) => Promise<AtlasHostRuntime<HostSdk>>;

const startDomHost = jest.fn<StartDomHostForHostSdk>();

jest.unstable_mockModule('./dom-host/dom-host.js', () => ({ startDomHost }));

installWebPlatformGlobals();

const { Link } = await import('react-router-dom');

const {
  AtlasDefaultHostLayout,
  AtlasHostLayout,
  AtlasHostProvider,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
  defineReactHost,
  useAtlasNavigationItems,
} = await import('./react.js');

const LAYOUT_ID = 'main';
const SLOT_ID = 'header';

function SdkConsumer() {
  const sdk = useAtlasSdk<HostSdk>();

  return createElement(
    'output',
    { 'data-testid': 'region' },
    sdk.hostData.region,
  );
}

function DefinedHostLayout() {
  return createElement(
    'main',
    { 'data-testid': 'defined-layout' },
    createElement(AtlasRouteOutlet),
  );
}

function HostNotFound() {
  return createElement('p', { 'data-testid': 'host-not-found' });
}

function HostProviders(props: { children?: ReactNode }) {
  return createElement(
    'section',
    { 'data-testid': 'host-providers' },
    props.children,
  );
}

function HostLoading() {
  const sdk = useAtlasSdk<HostSdk>();

  return createElement('output', null, sdk.hostData.region);
}

function HostError(props: AtlasErrorProps) {
  return createElement(
    'button',
    { type: 'button', onClick: props.retry },
    props.error.message,
  );
}

function routerLinkLoading(path: string) {
  return function RouterLinkLoading() {
    return createElement(Link, { to: path }, path);
  };
}

function NavigationItemsConsumer() {
  const items = useAtlasNavigationItems();

  return createElement(
    'output',
    { 'data-testid': 'items' },
    items.map((item) => item.label).join(','),
  );
}

function failingProviders(error: Error) {
  return function FailingProviders(): ReactElement {
    throw error;
  };
}

export class ReactAdapterDriver {
  readonly hostId = faker.string.uuid();
  private readonly stop = jest.fn<() => Promise<void>>(async () => undefined);
  private region = faker.location.countryCode();
  private readonly routerPathname = `/${faker.word.noun()}`;
  private useDefaultLayout = false;
  private rendered: RenderResult | undefined;
  private renderError: unknown;
  private hostName: string | undefined = faker.company.name();
  private runtimeConfig = aHostRuntimeConfig({ hostId: this.hostId });
  private catalog: AtlasHostCatalog | undefined;
  private legacyReactDom = faker.datatype.boolean();
  private hostProviders = faker.datatype.boolean();
  private notFound = faker.datatype.boolean();
  private hostComponents = faker.datatype.boolean();
  private linkPath = `/${faker.word.noun()}`;
  private readonly status = document.createElement('div');
  private readonly retry = jest.fn<RetryPlacementMount>();
  private readonly routerNavigate = jest.fn<RouterNavigate>();
  private readonly legacyRender =
    jest.fn<(element: ReactElement, container: Element) => void>();
  private readonly unmountComponentAtNode =
    jest.fn<(container: Element) => boolean>();
  private readonly container = document.createElement('div');
  private readonly onReady = jest.fn<() => void>();
  private readonly consoleError = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  private placeholder: Node | undefined;
  private providersError: Error | undefined;
  private legacyRoot: Root | undefined;
  private mounting: Promise<void | AtlasAppMountResult> | undefined;
  private unmount: (() => void | Promise<void>) | undefined;
  private error: unknown;

  constructor() {
    startDomHost.mockReset();

    startDomHost.mockImplementation(async (_options, services) => {
      services.onReady?.();

      return {
        hostId: this.hostId,
        manifests: [],
        retry: async () => undefined,
        updateHostData: () => undefined,
        stop: this.stop,
      };
    });
    this.legacyRender.mockImplementation((element, container) => {
      this.legacyRoot = createRoot(container);

      flushSync(() => this.legacyRoot!.render(element));
    });
    this.unmountComponentAtNode.mockImplementation(() => {
      this.legacyRoot!.unmount();

      return true;
    });

    this.consoleError.mockClear();
  }

  readonly given = {
    defaultLayout: () => {
      this.useDefaultLayout = true;

      return this;
    },
    region: (region: string) => {
      this.region = region;

      return this;
    },
    hostName: (hostName: string | undefined) => {
      this.hostName = hostName;

      return this;
    },
    runtimeConfig: (runtimeConfig: AtlasHostRuntimeConfig) => {
      this.runtimeConfig = runtimeConfig;

      return this;
    },
    catalog: (catalog: AtlasHostCatalog) => {
      this.catalog = catalog;

      return this;
    },
    hostProviders: (hostProviders: boolean) => {
      this.hostProviders = hostProviders;

      return this;
    },
    legacyReactDom: (legacyReactDom: boolean) => {
      this.legacyReactDom = legacyReactDom;

      return this;
    },
    notFound: (notFound: boolean) => {
      this.notFound = notFound;

      return this;
    },
    hostComponents: (hostComponents: boolean) => {
      this.hostComponents = hostComponents;

      return this;
    },
    linkPath: (linkPath: string) => {
      this.linkPath = linkPath;

      return this;
    },
    placeholder: (placeholder: Node) => {
      this.placeholder = placeholder;

      return this;
    },
    providersError: (error: Error) => {
      this.providersError = error;

      return this;
    },
    legacyRenderError: (error: Error) => {
      this.legacyRender.mockImplementationOnce(() => {
        throw error;
      });

      return this;
    },
    domHostStart: (start: Promise<AtlasHostRuntime<HostSdk>>) => {
      startDomHost.mockReturnValueOnce(start);

      return this;
    },
  };

  readonly when = {
    hostRendered: () =>
      act(async () => {
        this.rendered = render(this.host());
      }),
    regionChanged: async (region: string) => {
      this.region = region;
      await act(async () => {
        this.rendered!.rerender(this.host());
      });
    },
    layoutActivated: () =>
      act(async () => {
        this.anchors().setActiveLayout(
          this.useDefaultLayout ? 'default' : LAYOUT_ID,
        );
      }),
    routeNotFoundSet: (routeNotFound: boolean) =>
      act(async () => {
        this.anchors().setRouteNotFound(routeNotFound);
      }),
    defaultNotFoundLinkClicked: () =>
      act(async () => {
        document
          .querySelector<HTMLAnchorElement>('[data-atlas-not-found] a')!
          .click();
      }),
    navigationItemsPublished: async (labels: string[]) => {
      await act(async () => {
        publishAtlasNavigationItems(
          document,
          labels.map((label) => aNavigationItem({ label })),
        );
      });
    },
    unmounted: () =>
      act(async () => {
        this.rendered!.unmount();
      }),
    reactHostMounted: async () => {
      await this.when.reactHostMountRequested();

      try {
        this.unmount = (await this.mounting!)?.unmount;
      } catch (error) {
        this.error = error;
      }
    },
    reactHostMountRequested: async () => {
      if (this.placeholder) this.container.append(this.placeholder);

      document.body.replaceChildren(this.container);

      const mount = defineReactHost<HostSdk>({
        config: {
          id: this.hostId,
          ...(this.hostName ? { name: this.hostName } : {}),
        },
        layout: DefinedHostLayout,
        ...(this.providersError
          ? { providers: failingProviders(this.providersError) }
          : this.hostProviders
            ? { providers: HostProviders }
            : {}),
        ...(this.notFound ? { notFound: HostNotFound } : {}),
        ...(this.hostComponents
          ? { loading: routerLinkLoading(this.linkPath) }
          : {}),
        reactDom: this.legacyReactDom
          ? {
              render: this.legacyRender,
              unmountComponentAtNode: this.unmountComponentAtNode,
            }
          : { createRoot },
        useSdkOptions: () => ({ hostData: { region: this.region } }),
      });

      this.mounting = Promise.resolve(
        mount({
          container: this.container,
          runtimeConfig: this.runtimeConfig,
          ...(this.catalog ? { catalog: this.catalog } : {}),
        }),
      );

      this.mounting.catch(() => undefined);

      await act(async () => undefined);
    },
    readyReported: () =>
      act(async () => {
        startDomHost.mock.calls.at(-1)![1].onReady!();
      }),
    loadingShown: () =>
      act(async () => {
        document.body.append(this.status);

        this.get.startedServices().ui!.renderLoading!(this.status, {
          ...this.mountEvent(),
          state: 'loading',
        });
      }),
    errorShown: (error: Error) =>
      act(async () => {
        document.body.append(this.status);

        this.get.startedServices().ui!.renderError!(
          this.status,
          { ...this.mountEvent(), state: 'error', error },
          this.retry,
        );
      }),
    statusRetryClicked: () =>
      act(async () => {
        this.status.querySelector('button')!.click();
      }),
    reactHostUnmounted: () =>
      act(async () => {
        await this.unmount!();
      }),
    slotRenderedOutsideProvider: () => {
      try {
        render(createElement(AtlasSlot, { slotId: SLOT_ID }));
      } catch (error) {
        this.renderError = error;
      }
    },
  };

  readonly get = {
    startDomHostMock: () => startDomHost,
    startedOptions: () => startDomHost.mock.calls.at(-1)![0],
    stopMock: () => this.stop,
    regionText: () => this.rendered!.getByTestId('region').textContent,
    itemsText: () => this.rendered!.getByTestId('items').textContent,
    anchorTag: (kind: 'status' | 'navigation') =>
      this.anchors().get(kind)?.tagName,
    routeOutletParentTag: () =>
      this.anchors().get('route-outlet')?.parentElement?.tagName,
    hostNotFoundPresent: () =>
      document.querySelector('[data-testid="host-not-found"]') !== null,
    defaultNotFoundPresent: () =>
      document.querySelector('[data-atlas-not-found]') !== null,
    routerNavigateMock: () => this.routerNavigate,
    slotTag: () => this.anchors().get('slot', SLOT_ID)?.tagName,
    layoutContentPresent: () =>
      this.rendered!.queryByTestId('layout-content') !== null,
    renderError: () => this.renderError,
    container: () => this.container,
    definedLayoutPresent: () =>
      this.container.querySelector('[data-testid="defined-layout"]') !== null,
    layoutInsideProviders: () =>
      this.container.querySelector(
        '[data-testid="host-providers"] [data-testid="defined-layout"]',
      ) !== null,
    legacyRenderMock: () => this.legacyRender,
    onReadyMock: () => this.onReady,
    startedServices: () => startDomHost.mock.calls.at(-1)![1],
    hostRoot: () =>
      this.container.querySelector<HTMLElement>('atlas-host-root'),
    error: () => this.error,
    consoleErrorMock: () => this.consoleError,
    unmountComponentAtNodeMock: () => this.unmountComponentAtNode,
    startedNavigationPathname: async () =>
      (
        await startDomHost.mock.calls.at(-1)![1].createNavigation()
      ).getCurrentLocation().pathname,
    routerPathname: () => this.routerPathname,
    status: () => this.status,
    retryMock: () => this.retry,
    statusLinkHref: () => this.status.querySelector('a')?.getAttribute('href'),
    headerText: () =>
      this.rendered!.container.querySelector('header strong')?.textContent ??
      null,
  };

  private mountEvent() {
    return {
      manifest: anAppManifest(),
      placement: aRoutePlacement(),
      container: document.createElement('div'),
    };
  }

  private anchors() {
    return this.get.startedOptions().anchors!;
  }

  private host(): ReactNode {
    const children = this.useDefaultLayout
      ? [createElement(AtlasDefaultHostLayout, { key: 'default' })]
      : [
          createElement(SdkConsumer, { key: 'sdk' }),
          createElement(NavigationItemsConsumer, { key: 'items' }),
          createElement(AtlasHostStatus, { key: 'status' }),
          createElement(
            AtlasHostLayout,
            { key: 'layout', layoutId: LAYOUT_ID },
            createElement('div', { 'data-testid': 'layout-content' }),
            createElement(AtlasNavigation),
            createElement(AtlasSlot, { slotId: SLOT_ID }),
            createElement(AtlasRouteOutlet),
          ),
        ];

    return createElement(AtlasHostProvider<HostSdk>, {
      hostId: this.hostId,
      options: {
        runtimeConfig: aHostRuntimeConfig({ hostId: this.hostId }),
        federation: aFederationAdapter(),
        hostData: { region: this.region },
        router: {
          state: { location: { pathname: this.routerPathname } },
          navigate: this.routerNavigate,
          subscribe: () => () => undefined,
        },
      },
      ...(this.notFound ? { notFound: HostNotFound } : {}),
      ...(this.hostComponents
        ? { loading: HostLoading, error: HostError }
        : {}),
      onReady: this.onReady,
      children,
    });
  }
}
