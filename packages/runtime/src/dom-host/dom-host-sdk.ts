import {
  connectAtlasWidgetResolver,
  createAtlasSdk,
  type AtlasEventMap,
  type AtlasSdkOptions,
} from '@atlas/sdk';
import { createWidgetLoader } from '../widget-loader/widget-loader.js';
import type { AtlasWidgetLoaderOptions } from '../widget-loader/widget-loader.types.js';
import { pickWidgetUiOptionsFrom } from '../widget-loader/widget-ui-options.js';
import type {
  DomHostSdk,
  DomHostSdkInput,
  SdkProviderInput,
  SdkProviders,
} from './dom-host-sdk.types.js';
import type { DomHostOptions, DomRuntimeOptions } from './dom-host.types.js';

type AdapterOnlyOptionName =
  'router' | 'location' | 'hostDataInjector' | 'events';

type RuntimeOnlyOptionName =
  | keyof DomRuntimeOptions
  | keyof Omit<DomHostOptions, keyof DomRuntimeOptions>
  | 'hostId'
  | 'hostData'
  | 'eventBus'
  | AdapterOnlyOptionName;

const RUNTIME_ONLY_OPTIONS: Record<RuntimeOnlyOptionName, true> = {
  anchors: true,
  catalog: true,
  document: true,
  eventBus: true,
  events: true,
  federation: true,
  hostData: true,
  hostDataInjector: true,
  hostId: true,
  location: true,
  navigation: true,
  observe: true,
  onNavigationChange: true,
  renderError: true,
  renderHostError: true,
  renderHostLoading: true,
  renderLoading: true,
  renderWidgetError: true,
  renderWidgetLoading: true,
  router: true,
  runtimeConfig: true,
  sdk: true,
};

export function createSdkProviders<THostSdk extends object>(
  input: SdkProviderInput<THostSdk>,
): SdkProviders<THostSdk> {
  const sdk =
    input.options.sdk ??
    createDomHostSdk({
      options: input.options,
      hostId: input.hostId,
      navigation: input.navigation,
    });
  const loaderOptions: AtlasWidgetLoaderOptions = {
    importWidget: input.importWidget,
    ...(input.resolveWidget ? { resolveWidget: input.resolveWidget } : {}),
    ...(input.trustPolicy ? { trustPolicy: input.trustPolicy } : {}),
    ...pickWidgetUiOptionsFrom(input.options),
  };
  const widgetLoader = createWidgetLoader({
    manifests: input.manifests,
    sdk,
    options: loaderOptions,
  });

  connectAtlasWidgetResolver(sdk, widgetLoader.getWidget);

  return { sdk, widgetLoader };
}

export function createDomHostSdk<THostSdk extends object>(
  input: DomHostSdkInput<THostSdk>,
): DomHostSdk<THostSdk> {
  const { options, hostId, navigation } = input;
  const sdkOptions = {
    hostId,
    ...(options.hostData ? { hostData: options.hostData } : {}),
    navigation,
    ...(options.eventBus ? { eventBus: options.eventBus } : {}),
    ...pickHostDefinedSdkProperties(options),
  } as unknown as AtlasSdkOptions<THostSdk, AtlasEventMap>;

  return createAtlasSdk<THostSdk, AtlasEventMap>(sdkOptions);
}

function pickHostDefinedSdkProperties<THostSdk extends object>(
  options: DomHostOptions<THostSdk>,
): object {
  return Object.fromEntries(
    Object.entries(options).filter(([name]) => !(name in RUNTIME_ONLY_OPTIONS)),
  );
}
