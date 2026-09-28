import { faker } from '@faker-js/faker';
import {
  createAtlasEventBus,
  createAtlasSdk,
  type AtlasEventMap,
  type AtlasGetWidget,
  type AtlasSdk,
} from '@atlas/sdk/host';
import type { AtlasNavigation } from '@atlas/sdk/navigation';
import type { MockAtlasSdkOverrides } from '../atlas-environment.types.js';

export interface MockSdkOptions<
  THostSdk extends object,
  TEvents extends object,
> {
  navigation: AtlasNavigation;
  overrides: MockAtlasSdkOverrides<THostSdk, TEvents>;
}

const PROBED_PROPERTIES = new Set([
  'then',
  'toJSON',
  'asymmetricMatch',
  'nodeType',
  'tagName',
  'ngOnDestroy',
]);

const PROBED_PREFIXES = ['_', '$$', '@@'];

export function createMockSdk<
  THostSdk extends object = {},
  TEvents extends object = AtlasEventMap,
>({
  navigation,
  overrides,
}: MockSdkOptions<THostSdk, TEvents>): AtlasSdk<THostSdk, TEvents> {
  const {
    hostId = faker.string.uuid(),
    hostData = {},
    events = createAtlasEventBus<TEvents>(),
    navigateTo = () => undefined,
    getWidget = anInertWidgetResolver(),
    ...extensions
  } = overrides;

  const sdk = createAtlasSdk<{}, TEvents>({
    hostId,
    navigation,
    eventBus: events,
    hostData: { name: faker.company.name(), ...hostData },
  });
  Object.assign(sdk, extensions, { navigateTo, getWidget });

  return new Proxy(sdk, {
    get: (target, property, receiver) =>
      typeof property === 'symbol' ||
      property in target ||
      isProbedProperty(property)
        ? Reflect.get(target, property, receiver)
        : aNotMockedMember(property),
  }) as AtlasSdk<THostSdk, TEvents>;
}

function anInertWidgetResolver(): AtlasGetWidget {
  return (widgetId) => ({
    id: widgetId,
    name: faker.commerce.productName(),
    mount: async () => ({ unmount: async () => undefined }),
  });
}

function isProbedProperty(property: string | symbol): boolean {
  if (typeof property === 'symbol') return true;

  return (
    PROBED_PROPERTIES.has(property) ||
    PROBED_PREFIXES.some((prefix) => property.startsWith(prefix))
  );
}

function aNotMockedMember(property: string): unknown {
  const fail = (): never => {
    throw new Error(
      `Atlas SDK "${property}" is not mocked. Pass it to mockAtlasEnvironment({ sdk: { ${property} } }).`,
    );
  };

  return new Proxy(fail, {
    apply: fail,
    get: (_target, member) => (isProbedProperty(member) ? undefined : fail()),
  });
}
