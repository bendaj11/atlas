import type { AtlasExportedWidgetManifest, AtlasManifest } from '@atlas/schema';
import { getAtlasNavigation } from '@atlas/sdk';
import type {
  AtlasGetWidgetOptions,
  AtlasSdk,
  AtlasWidgetHandle,
  AtlasWidgetLoadingRenderer,
} from '@atlas/sdk/host';
import type {
  AtlasAppContext,
  AtlasExportedWidgetEntry,
  AtlasExportedWidgetMountResult,
  AtlasMountedWidget,
  AtlasWidgetLoader,
} from '@atlas/sdk/lifecycle';
import {
  createRouteContext,
  createScopedNavigation,
} from '@atlas/sdk/navigation';
import {
  AtlasWidgetMountExportMissingError,
  AtlasWidgetOwnerUntrustedError,
} from '../loader/loader.errors.js';
import { verifyManifestIntegrity } from '../loader/trust/manifest-integrity.js';
import { PERMISSIVE_TRUST_POLICY } from '../loader/trust/trust-policy.js';
import { createMountBoundary } from '../mount-app/mount-boundary.js';
import { startRemoteAssetRewrite } from '../remote-assets/index.js';
import {
  isMountableEntry,
  unwrapDefaultExport,
} from '../shared/module-entry.js';
import { findDefaultRoutePathOfManifest } from '../shared/route-path.js';
import {
  isLoopbackHostname,
  resolveUrlAgainstDocument,
} from '../shared/url.js';
import { loadManifestStyles } from '../stylesheets/stylesheets.js';
import { createWidgetCard, createWidgetRenderContext } from './widget-card.js';
import {
  AtlasWidgetMountError,
  AtlasWidgetRemoteMismatchError,
  AtlasWidgetResolverMissingError,
} from './widget-loader.errors.js';
import type {
  AtlasResolvedWidget,
  CreateWidgetLoaderInput,
  MountedWidgetState,
  MountResolvedWidgetInput,
  WidgetCard,
} from './widget-loader.types.js';

export function createWidgetLoader(
  input: CreateWidgetLoaderInput,
): AtlasWidgetLoader {
  const { manifests, sdk } = input;
  const options = input.options ?? {};
  const knownWidgets = indexWidgetsByQualifiedAndBareId(manifests);
  const pendingResolutions = new Map<string, Promise<AtlasResolvedWidget>>();
  const importedEntries = new Map<string, Promise<AtlasExportedWidgetEntry>>();
  const ownerIntegrityChecks = new Map<string, Promise<void>>();

  const resolveWidget = async (widgetId: string) => {
    const known = knownWidgets.get(widgetId);

    if (known) return known;

    if (!options.resolveWidget)
      throw new AtlasWidgetResolverMissingError(widgetId);

    const pending = pendingResolutions.get(widgetId);

    if (pending) return pending;

    const resolving = options
      .resolveWidget(widgetId)
      .then((resolved) => {
        knownWidgets.set(resolved.widget.id, resolved);

        return resolved;
      })
      .finally(() => pendingResolutions.delete(widgetId));

    pendingResolutions.set(widgetId, resolving);

    return resolving;
  };

  const verifyOwnerIntegrity = (resolved: AtlasResolvedWidget) => {
    const key = `${resolved.ownerManifest.remoteEntryUrl}\0${resolved.ownerManifest.integrity ?? ''}`;
    const existing = ownerIntegrityChecks.get(key);

    if (existing) return existing;

    const checking = verifyManifestIntegrity({
      manifests: [resolved.ownerManifest],
      policy: options.trustPolicy ?? PERMISSIVE_TRUST_POLICY,
    }).catch((error) => {
      ownerIntegrityChecks.delete(key);

      throw error;
    });

    ownerIntegrityChecks.set(key, checking);

    return checking;
  };

  const importEntry = (resolved: AtlasResolvedWidget) => {
    const key = `${resolved.widget.ownerAppId}/${resolved.widget.expose}@${resolved.widget.remoteEntryUrl}`;
    const existing = importedEntries.get(key);

    if (existing) return existing;

    const importing = (
      options.importWidget
        ? options.importWidget(resolved.widget, resolved.ownerManifest)
        : importExportedWidget(resolved.widget, resolved.ownerManifest)
    ).catch((error) => {
      importedEntries.delete(key);

      throw error;
    });

    importedEntries.set(key, importing);

    return importing;
  };

  const mountWidgetById = <TProps extends object>(input: {
    widgetId: string;
    container: HTMLElement;
    props: TProps;
    renderLoading?: AtlasWidgetLoadingRenderer;
  }) =>
    mountResolvedWidget({
      widgetId: input.widgetId,
      container: input.container,
      props: input.props,
      sdk,
      resolveWidget,
      verifyOwnerIntegrity,
      importEntry,
      initialContext: createWidgetRenderContext(
        input.widgetId,
        knownWidgets.get(input.widgetId),
      ),
      options,
      ...(input.renderLoading ? { renderLoading: input.renderLoading } : {}),
    });

  const getWidget = <TInputs extends object>(
    widgetId: string,
    widgetOptions?: AtlasGetWidgetOptions,
  ): AtlasWidgetHandle<TInputs> => ({
    id: widgetId,
    name: knownWidgets.get(widgetId)?.widget.name ?? widgetId,
    mount: (container, props) =>
      mountWidgetById({
        widgetId,
        container,
        props,
        ...(widgetOptions?.renderLoading
          ? { renderLoading: widgetOptions.renderLoading }
          : {}),
      }),
  });

  return {
    list(ownerAppId) {
      const seenWidgetIds = new Set<string>();

      return [...knownWidgets.values()]
        .filter(
          ({ ownerManifest }) => !ownerAppId || ownerManifest.id === ownerAppId,
        )
        .map(({ widget }) => widget)
        .filter(
          (widget) =>
            !seenWidgetIds.has(widget.id) && seenWidgetIds.add(widget.id),
        );
    },
    getWidget,
    mount: (widgetId, container, props) =>
      mountWidgetById({ widgetId, container, props }),
  };
}

function indexWidgetsByQualifiedAndBareId(
  manifests: readonly AtlasManifest[],
): Map<string, AtlasResolvedWidget> {
  const widgets = new Map<string, AtlasResolvedWidget>();
  const warnedDuplicateWidgetIds = new Set<string>();

  for (const ownerManifest of manifests) {
    for (const widget of ownerManifest.exportedWidgets ?? []) {
      const resolved = { widget, ownerManifest };

      widgets.set(`${ownerManifest.id}/${widget.id}`, resolved);

      const existing = widgets.get(widget.id);

      if (!existing) {
        widgets.set(widget.id, resolved);
      } else if (
        existing.ownerManifest.id !== ownerManifest.id &&
        !warnedDuplicateWidgetIds.has(widget.id)
      ) {
        warnedDuplicateWidgetIds.add(widget.id);

        console.warn(
          `Atlas found widget id "${widget.id}" in multiple apps and selected "${existing.ownerManifest.id}". ` +
            'Suggested action: Assign a unique UUIDv4 to each exported widget, rebuild the affected apps, and republish their manifests.',
        );
      }
    }
  }

  return widgets;
}

async function mountResolvedWidget<TProps extends object>(
  input: MountResolvedWidgetInput<TProps>,
): Promise<AtlasMountedWidget<TProps>> {
  const state: MountedWidgetState<TProps> = { disposed: false };

  await attemptWidgetMount(input, state);

  return {
    get widget() {
      return state.current?.widget;
    },
    setInputs(inputs) {
      input.props = inputs;
      state.current?.setInputs?.(inputs);
    },
    async unmount() {
      state.disposed = true;

      await state.current?.unmount();
    },
  };
}

async function attemptWidgetMount<TProps extends object>(
  input: MountResolvedWidgetInput<TProps>,
  state: MountedWidgetState<TProps>,
): Promise<void> {
  const card = createWidgetCard({
    parent: input.container,
    context: input.initialContext,
    options: input.options,
    ...(input.renderLoading ? { renderLoading: input.renderLoading } : {}),
  });
  state.current = {
    widget: undefined,
    setInputs() {},
    async unmount() {
      card.remove();
    },
  };

  card.showLoading();

  let resolved: AtlasResolvedWidget | undefined;

  try {
    resolved = await input.resolveWidget(input.widgetId);

    await input.verifyOwnerIntegrity(resolved);

    const entry = await input.importEntry(resolved);

    card.clearStatus();

    const mounted = await mountWidgetEntry({ input, card, resolved, entry });

    if (state.disposed) await mounted.unmount();
    else state.current = mounted;
  } catch (error) {
    if (state.disposed) {
      card.remove();

      return;
    }

    card.showError({
      error: new AtlasWidgetMountError(input.widgetId, error),
      retry: () => {
        card.remove();

        if (!state.disposed) void attemptWidgetMount(input, state);
      },
      ...(resolved ? { resolved } : {}),
    });
  }
}

async function mountWidgetEntry<TProps extends object>(input: {
  input: MountResolvedWidgetInput<TProps>;
  card: WidgetCard;
  resolved: AtlasResolvedWidget;
  entry: AtlasExportedWidgetEntry;
}): Promise<AtlasMountedWidget<TProps>> {
  const { card, resolved, entry } = input;
  const { props, sdk } = input.input;
  const document = card.element.ownerDocument ?? globalThis.document;
  const boundary = createMountBoundary({
    parent: card.element,
    id: resolved.widget.id,
    isolation: resolved.ownerManifest.isolation ?? 'shadow-dom',
    kind: 'widget',
  });
  const releaseStyles = await loadManifestStyles(
    resolved.ownerManifest,
    document,
    { target: boundary.styleTarget },
  );
  const releaseAssetRewrite = startRemoteAssetRewrite(
    resolved.ownerManifest,
    boundary.container,
    document,
  );
  const releaseMountResources = () => {
    releaseAssetRewrite();
    boundary.remove();
    releaseStyles();
  };
  let result: void | AtlasExportedWidgetMountResult;

  try {
    result = await entry.mount({
      container: boundary.container,
      styleTarget: boundary.styleTarget,
      props,
      sdk,
      context: createExportedWidgetContext(resolved.ownerManifest, sdk),
      ...resolved,
    });
  } catch (error) {
    releaseMountResources();

    throw error;
  }

  return {
    widget: resolved.widget,
    setInputs(inputs) {
      result?.setInputs?.(inputs);
    },
    async unmount() {
      try {
        await result?.unmount?.();
      } finally {
        releaseMountResources();
        card.remove();
      }
    },
  };
}

function createExportedWidgetContext(
  manifest: AtlasManifest,
  sdk: AtlasSdk,
): AtlasAppContext {
  const hostNavigation = getAtlasNavigation(sdk);
  const navigation = createScopedNavigation(
    findDefaultRoutePathOfManifest(manifest),
    hostNavigation,
  );

  return {
    manifest,
    hostId: sdk.hostId,
    path: navigation.path,
    navigation,
    route: createRouteContext(navigation.path, hostNavigation),
    loading: {
      show: () => undefined,
      hide: () => undefined,
      waitUntilReady: () => () => undefined,
    },
  };
}

export async function importExportedWidget(
  widget: AtlasExportedWidgetManifest,
  ownerManifest?: AtlasManifest,
): Promise<AtlasExportedWidgetEntry> {
  const widgetReference = `${widget.ownerAppId}/${widget.id}`;

  if (!ownerManifest) {
    if (
      !isLoopbackHostname(
        resolveUrlAgainstDocument(widget.remoteEntryUrl).hostname,
      )
    ) {
      throw new AtlasWidgetOwnerUntrustedError({
        widgetId: widget.id,
        ownerAppId: widget.ownerAppId,
      });
    }
  } else {
    if (
      resolveUrlAgainstDocument(widget.remoteEntryUrl).href !==
      resolveUrlAgainstDocument(ownerManifest.remoteEntryUrl).href
    ) {
      throw new AtlasWidgetRemoteMismatchError(widgetReference);
    }

    await verifyManifestIntegrity({ manifests: [ownerManifest] });
  }

  const entry = unwrapDefaultExport(
    await import(/* @vite-ignore */ widget.remoteEntryUrl),
  );

  if (!isMountableEntry(entry))
    throw new AtlasWidgetMountExportMissingError(widgetReference);

  return entry;
}
