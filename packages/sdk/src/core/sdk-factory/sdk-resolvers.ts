import type { AtlasNavigation } from '../../navigation/navigation-types/navigation-types.js';
import type {
  AtlasGetWidget,
  AtlasGetWidgetOptions,
  AtlasNavigationState,
  AtlasWidgetHandle,
} from '../sdk-types/index.js';
import { sdkError } from '../sdk-error/sdk-error.js';

export type NavigationResolver = (
  appId: string,
  state?: AtlasNavigationState,
) => void;

const widgetResolvers = new WeakMap<object, AtlasGetWidget>();
const navigationResolvers = new WeakMap<object, NavigationResolver>();
const hostNavigations = new WeakMap<object, AtlasNavigation>();

/** Connects host runtime widget discovery after SDK construction. */
export function connectAtlasWidgetResolver(
  sdk: object,
  resolver: AtlasGetWidget,
): void {
  widgetResolvers.set(sdk, resolver);
}

/** Connects host catalog route resolution after runtime discovery. */
export function connectAtlasNavigationResolver(
  sdk: object,
  resolver: NavigationResolver,
): void {
  navigationResolvers.set(sdk, resolver);
}

export function registerHostNavigation(
  sdk: object,
  navigation: AtlasNavigation,
): void {
  hostNavigations.set(sdk, navigation);
}

/** Returns host navigation for Atlas runtime internals. Apps should use their router or `navigateTo`. */
export function getAtlasNavigation(sdk: object): AtlasNavigation {
  const navigation = hostNavigations.get(sdk);
  if (navigation) return navigation;

  throw sdkError('Atlas host navigation is unavailable.', {
    suggestedActions:
      'Create the Atlas SDK with host navigation before starting the runtime.',
    code: 'ATLAS_HOST_NAVIGATION_NOT_READY',
  });
}

export function resolveWidget<TInputs extends object>(
  sdk: object,
  widgetId: string,
  options?: AtlasGetWidgetOptions,
): AtlasWidgetHandle<TInputs> {
  const resolver = widgetResolvers.get(sdk);
  if (resolver) return resolver<TInputs>(widgetId, options);

  throw sdkError(
    `Atlas cannot resolve widget "${widgetId}" because the host widget runtime is not ready.`,
    {
      suggestedActions:
        'Wait for the Atlas host to finish starting before requesting the widget.',
      code: 'ATLAS_WIDGET_RUNTIME_NOT_READY',
    },
  );
}

export function resolveNavigation(
  sdk: object,
  appId: string,
  state?: AtlasNavigationState,
): void {
  const resolver = navigationResolvers.get(sdk);
  if (resolver) {
    resolver(appId, state);

    return;
  }

  throw sdkError(
    `Atlas cannot navigate to app "${appId}" because the host route catalog is not ready.`,
    {
      suggestedActions:
        'Wait for the Atlas host to finish starting before navigating.',
      code: 'ATLAS_ROUTE_RUNTIME_NOT_READY',
    },
  );
}
