import { jest } from '@jest/globals';
import { faker } from '@faker-js/faker';
import { act, render, type RenderResult } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { useAtlasSdk } from '@atlas/sdk/react';
import { aHostRuntimeConfig } from '@atlas/testkit';
import type { AtlasHostRuntime } from './host-runtime/host-runtime.types.js';
import type {
  DomHostOptions,
  DomHostServices,
} from './dom-host/dom-host.types.js';
import { publishAtlasNavigationItems } from './dom-host/host-navigation.js';
import { aNavigationItem } from './dom-host/host-navigation.testkit.js';
import { aFederationAdapter } from './loader/native-federation.testkit.js';

interface HostSdk {
  readonly hostData: { readonly region: string };
}

type StartDomHostForHostSdk = (
  options: DomHostOptions<HostSdk>,
  services: DomHostServices<HostSdk>,
) => Promise<AtlasHostRuntime<HostSdk>>;

const startDomHost = jest.fn<StartDomHostForHostSdk>();

jest.unstable_mockModule('./dom-host/dom-host.js', () => ({ startDomHost }));

const {
  AtlasDefaultHostLayout,
  AtlasHostLayout,
  AtlasHostProvider,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
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
