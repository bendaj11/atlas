import { connectAtlasWidgetResolver, getAtlasNavigation } from '@atlas/sdk';
import type { AtlasAppEntry, AtlasAppMountResult } from '@atlas/sdk/lifecycle';
import {
  createRouteContext,
  createScopedNavigation,
} from '@atlas/sdk/navigation';
import type { AtlasMountedApp } from '../host-runtime/host-runtime.types.js';
import { importNativeFederationRemote } from '../loader/native-federation.js';
import {
  assertManifestAssetTrust,
  PERMISSIVE_TRUST_POLICY,
} from '../loader/trust/trust-policy.js';
import { startRemoteAssetRewrite } from '../remote-assets/index.js';
import { findDefaultRoutePathOfManifest } from '../shared/route-path.js';
import { loadManifestStyles } from '../stylesheets/stylesheets.js';
import { createWidgetLoader } from '../widget-loader/widget-loader.js';
import { pickWidgetUiOptionsFrom } from '../widget-loader/widget-ui-options.js';
import type {
  AtlasMountAppOptions,
  RouteTitleController,
} from './mount-app.types.js';
import { createMountBoundary } from './mount-boundary.js';

export async function mountApp(
  options: AtlasMountAppOptions,
): Promise<AtlasMountedApp> {
  const document = options.container.ownerDocument ?? globalThis.document;

  if (!options.importRemote || options.trustPolicy) {
    assertManifestAssetTrust(
      options.manifest,
      options.trustPolicy ?? PERMISSIVE_TRUST_POLICY,
    );
  }

  const boundary = createMountBoundary({
    parent: options.container,
    id: options.manifest.id,
    isolation: options.manifest.isolation ?? 'shadow-dom',
    kind: 'app',
  });
  const releaseStyles = await loadManifestStyles(options.manifest, document, {
    ...(options.trustPolicy ? { policy: options.trustPolicy } : {}),
    target: boundary.styleTarget,
  });
  const releaseAssetRewrite = startRemoteAssetRewrite(
    options.manifest,
    boundary.container,
    document,
  );
  const titleController = createRouteTitleController(
    document,
    options.routeTitle,
  );
  const releaseMountResources = () => {
    releaseAssetRewrite();
    boundary.remove();
    titleController.reset();
    releaseStyles();
  };
  let result: void | AtlasAppMountResult;

  try {
    const entry = await importAppEntryFromRemote(options);
    const hostNavigation = getAtlasNavigation(options.sdk);
    const navigation = createScopedNavigation(
      options.path ?? findDefaultRoutePathOfManifest(options.manifest),
      hostNavigation,
    );
    const widgets =
      options.widgetLoader ??
      createWidgetLoader({
        manifests: [options.manifest],
        sdk: options.sdk,
        options: {
          ...(options.importWidget
            ? { importWidget: options.importWidget }
            : {}),
          ...(options.trustPolicy ? { trustPolicy: options.trustPolicy } : {}),
          ...pickWidgetUiOptionsFrom(options),
        },
      });

    connectAtlasWidgetResolver(options.sdk, widgets.getWidget);

    result = await entry.mount({
      container: boundary.container,
      styleTarget: boundary.styleTarget,
      sdk: options.sdk,
      context: {
        manifest: options.manifest,
        hostId: options.hostId,
        path: navigation.path,
        navigation,
        route: createRouteContext(navigation.path, hostNavigation, {
          setTabTitle: titleController.set,
        }),
        loading: {
          show: () => options.onLoadingChange?.(true),
          hide: () => options.onLoadingChange?.(false),
          waitUntilReady: () =>
            options.onReadyRequested?.() ??
            options.onReady ??
            (() => undefined),
        },
      },
    });
  } catch (error) {
    releaseMountResources();

    throw error;
  }

  return {
    manifest: options.manifest,
    async unmount() {
      try {
        await result?.unmount?.();
      } finally {
        releaseMountResources();
      }
    },
  };
}

function importAppEntryFromRemote(
  options: Pick<
    AtlasMountAppOptions,
    'importRemote' | 'trustPolicy' | 'manifest'
  >,
): Promise<AtlasAppEntry> {
  if (options.importRemote) return options.importRemote(options.manifest);

  return importNativeFederationRemote(
    options.manifest,
    options.trustPolicy ?? PERMISSIVE_TRUST_POLICY,
  );
}

function createRouteTitleController(
  document: Document | undefined,
  initialTitle: string | undefined,
): RouteTitleController {
  if (!document) return { set() {}, reset() {} };

  const previousTitle = document.title;
  let changed = false;
  const set = (title: string) => {
    document.title = title;
    changed = true;
  };

  if (initialTitle !== undefined) set(initialTitle);

  return {
    set,
    reset() {
      if (!changed) return;

      document.title = previousTitle;
      changed = false;
    },
  };
}
