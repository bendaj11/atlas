import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { act, render, type RenderResult } from '@testing-library/react';
import { createElement, type ReactElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useAtlasSdk } from '@atlas/sdk/react';
import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { aHostRuntimeConfig } from '@atlas/testkit';
import type { AtlasHostRuntime } from './host-runtime/host-runtime.types.js';
import type {
  DomHostOptions,
  DomHostServices,
  RenderHostLoading,
} from './dom-host/dom-host.types.js';
import { publishAtlasNavigationItems } from './dom-host/host-navigation.js';
import { aNavigationItem } from './dom-host/host-navigation.testkit.js';
import { aFederationAdapter } from './loader/native-federation.testkit.js';
import { installWebPlatformGlobals } from './shared/web-platform.testkit.js';

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
  return createElement('main', { 'data-testid': 'defined-layout' });
}

function HostProviders(props: { children?: ReactNode }) {
  return createElement(
    'section',
    { 'data-testid': 'host-providers' },
    props.children,
  );
}

function NavigationItemsConsumer() {
  const items = useAtlasNavigationItems();

  return createElement(
    'output',
    { 'data-testid': 'items' },
    items.map((item) => item.label).join(','),
  );
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
  private readonly legacyRender =
    jest.fn<(element: ReactElement, container: Element) => void>();
  private readonly unmountComponentAtNode =
    jest.fn<(container: Element) => boolean>();
  private readonly container = document.createElement('div');
  private readonly renderHostLoading = jest.fn<RenderHostLoading>();
  private unmount: (() => void | Promise<void>) | undefined;

  constructor() {
    startDomHost.mockReset();

    startDomHost.mockImplementation(async () => ({
      hostId: this.hostId,
      manifests: [],
      retry: async () => undefined,
      updateHostData: () => undefined,
      stop: this.stop,
    }));

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
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
      document.body.replaceChildren(this.container);

      const mount = defineReactHost<HostSdk>({
        config: {
          id: this.hostId,
          ...(this.hostName ? { name: this.hostName } : {}),
        },
        layout: DefinedHostLayout,
        ...(this.hostProviders ? { providers: HostProviders } : {}),
        reactDom: this.legacyReactDom
          ? {
              render: this.legacyRender,
              unmountComponentAtNode: this.unmountComponentAtNode,
            }
          : { createRoot },
        useSdkOptions: () => ({
          hostData: { region: this.region },
          renderHostLoading: this.renderHostLoading,
        }),
      });

      await act(async () => {
        const mounted = await mount({
          container: this.container,
          runtimeConfig: this.runtimeConfig,
          ...(this.catalog ? { catalog: this.catalog } : {}),
        });

        this.unmount = mounted?.unmount;
      });
    },
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
    anchorTag: (kind: 'status' | 'navigation' | 'route-outlet') =>
      this.anchors().get(kind)?.tagName,
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
    renderHostLoadingMock: () => this.renderHostLoading,
    unmountComponentAtNodeMock: () => this.unmountComponentAtNode,
    startedNavigationPathname: async () =>
      (
        await startDomHost.mock.calls.at(-1)![1].createNavigation()
      ).getCurrentLocation().pathname,
    routerPathname: () => this.routerPathname,
    headerText: () =>
      this.rendered!.container.querySelector('header strong')?.textContent ??
      null,
  };

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
          navigate: () => undefined,
          subscribe: () => () => undefined,
        },
      },
      children,
    });
  }
}
