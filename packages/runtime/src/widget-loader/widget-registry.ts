import type {
  AtlasAppManifest,
  AtlasExportedWidgetManifest,
  AtlasHostCatalog,
  AtlasHostRuntimeConfig,
} from '@atlas/schema';
import { runtimeError } from './runtime-error.js';

export interface AtlasResolvedWidget {
  widget: AtlasExportedWidgetManifest;
  ownerManifest: AtlasAppManifest;
}

export type AtlasWidgetResolver = (
  widgetId: string,
) => Promise<AtlasResolvedWidget>;

interface WidgetRegistryOptions {
  catalog: AtlasHostCatalog;
  /** @deprecated Runtime config is no longer used for external registry discovery. */
  runtimeConfig?: AtlasHostRuntimeConfig;
}

/** Resolves widgets selected in the active environment manifest. */
export function createRegistryWidgetResolver(
  options: WidgetRegistryOptions,
): AtlasWidgetResolver {
  const selected = [
    ...options.catalog.apps,
    ...(options.catalog.widgetProviders ?? []),
  ];
  const widgets = indexWidgets(selected);

  return (widgetId) => {
    assertWidgetId(widgetId);
    const known = widgets.get(widgetId);
    if (known) return Promise.resolve(known);
    return Promise.reject(
      runtimeError(
        `Atlas could not find widget "${widgetId}" in the active environment manifest.`,
        {
          code: 'ATLAS_WIDGET_NOT_FOUND',
          suggestedActions:
            'Deploy its provider app to this environment and retry.',
        },
      ),
    );
  };
}

function indexWidgets(
  manifests: readonly AtlasAppManifest[],
): Map<string, AtlasResolvedWidget> {
  const widgets = new Map<string, AtlasResolvedWidget>();
  for (const ownerManifest of manifests) {
    for (const widget of ownerManifest.exportedWidgets ?? []) {
      const existing = widgets.get(widget.id);
      if (existing && existing.ownerManifest.id !== ownerManifest.id) {
        throw runtimeError(
          `Atlas found widget "${widget.id}" in more than one provider app.`,
          {
            code: 'ATLAS_WIDGET_AMBIGUOUS',
            suggestedActions:
              'Give every exported widget a globally unique UUID.',
          },
        );
      }
      widgets.set(widget.id, { widget, ownerManifest });
    }
  }
  return widgets;
}

function assertWidgetId(widgetId: string): void {
  if (!widgetId.trim()) {
    throw runtimeError('Atlas widget id cannot be empty.', {
      code: 'ATLAS_WIDGET_ID_INVALID',
      suggestedActions: 'Pass the UUID from the exported widget manifest.',
    });
  }
}
