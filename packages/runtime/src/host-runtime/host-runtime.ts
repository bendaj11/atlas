import {
  connectAtlasNavigationResolver,
  getAtlasNavigation,
  updateAtlasHostData,
} from '@atlas/sdk';
import { createAppNavigator } from '../app-navigator/app-navigator.js';
import { createWidgetLoader } from '../widget-loader/widget-loader.js';
import { pickWidgetUiOptionsFrom } from '../widget-loader/widget-ui-options.js';
import type {
  AtlasHostRuntime,
  AtlasHostRuntimeOptions,
} from './host-runtime.types.js';
import {
  collectPlacementsForHost,
  createNavigationTargetsFromPlacements,
  createRoutePlacementPlan,
  filterRoutePlacements,
  filterSlotPlacements,
  logRouteConflict,
} from './route-plan.js';
import { AtlasRuntimeController } from './runtime-controller.js';

/** Owns catalog placement lifecycle while the framework adapter owns browser navigation. */
export async function startAtlasHostRuntime<THostSdk extends object = {}>(
  options: AtlasHostRuntimeOptions<THostSdk>,
): Promise<AtlasHostRuntime<THostSdk>> {
  const navigation = getAtlasNavigation(options.sdk);
  const widgetLoader =
    options.widgetLoader ??
    createWidgetLoader({
      manifests: options.manifests,
      sdk: options.sdk,
      options: {
        ...(options.importWidget ? { importWidget: options.importWidget } : {}),
        ...(options.trustPolicy ? { trustPolicy: options.trustPolicy } : {}),
        ...pickWidgetUiOptionsFrom(options),
      },
    });
  const placements = collectPlacementsForHost(
    options.manifests,
    options.hostId,
  );
  const routePlan = createRoutePlacementPlan(filterRoutePlacements(placements));

  connectAtlasNavigationResolver(
    options.sdk,
    createAppNavigator(
      navigation,
      createNavigationTargetsFromPlacements(routePlan.available),
    ),
  );

  for (const conflict of routePlan.conflicts)
    logRouteConflict(options.hostId, conflict);

  const controller = new AtlasRuntimeController({
    options,
    widgetLoader,
    routePlacements: routePlan.available,
    slotPlacements: filterSlotPlacements(placements),
  });

  await controller.reconcileSlots();
  await controller.reconcileRoute(navigation.getCurrentLocation().pathname);

  const reconcileCurrentRoute = () =>
    controller.enqueueRouteReconcile(navigation.getCurrentLocation().pathname);

  const unsubscribeNavigation = navigation.subscribe((location) => {
    controller.enqueueRouteReconcile(location.pathname);
  });

  reconcileCurrentRoute();

  const unsubscribeAnchors =
    options.subscribeAnchors?.(() => {
      reconcileCurrentRoute();
      controller.enqueueSlotReconcile();
    }) ?? (() => undefined);

  return {
    hostId: options.hostId,
    manifests: options.manifests,
    retry: (appId) => controller.retry(appId),
    updateHostData: (updates) => updateAtlasHostData(options.sdk, updates),
    stop: () =>
      controller.stop(() => {
        unsubscribeNavigation();
        unsubscribeAnchors();
      }),
  };
}
