import type { AtlasAppManifest } from '@atlas/schema';
import {
  AtlasWidgetAmbiguousError,
  AtlasWidgetIdInvalidError,
  AtlasWidgetNotFoundError,
} from './widget-loader.errors.js';
import type {
  AtlasResolvedWidget,
  AtlasWidgetResolver,
  WidgetRegistryOptions,
} from './widget-loader.types.js';

/** Resolves widgets selected in the active environment manifest. */
export function createRegistryWidgetResolver(
  options: WidgetRegistryOptions,
): AtlasWidgetResolver {
  const selected = [
    ...options.catalog.apps,
    ...(options.catalog.widgetProviders ?? []),
  ];
  const widgetsById = indexWidgetsById(selected);

  return (widgetId) => {
    assertWidgetIdIsNotBlank(widgetId);

    const known = widgetsById.get(widgetId);

    if (known) return Promise.resolve(known);

    return Promise.reject(new AtlasWidgetNotFoundError(widgetId));
  };
}

function indexWidgetsById(
  manifests: readonly AtlasAppManifest[],
): Map<string, AtlasResolvedWidget> {
  const widgetsById = new Map<string, AtlasResolvedWidget>();

  for (const ownerManifest of manifests) {
    for (const widget of ownerManifest.exportedWidgets ?? []) {
      const existing = widgetsById.get(widget.id);

      if (existing && existing.ownerManifest.id !== ownerManifest.id)
        throw new AtlasWidgetAmbiguousError(widget.id);

      widgetsById.set(widget.id, { widget, ownerManifest });
    }
  }

  return widgetsById;
}

function assertWidgetIdIsNotBlank(widgetId: string): void {
  if (!widgetId.trim()) throw new AtlasWidgetIdInvalidError();
}
