import type { AtlasModalRequest, AtlasPopupRef } from "./host-overlays.js";
import type { AtlasWidgetLoader } from "./lifecycle.js";
import { createOverlayContentMount } from "./overlay-content.js";
import type { AtlasOverlayController, AtlasOverlayContentMount, AtlasOverlayProviders } from "./overlay-types.js";

/** Connects SDK overlay calls to the host's UI library and mounts catalog-selected widgets into its outlet. */
export function createAtlasOverlayController(options: {
  providers: AtlasOverlayProviders;
  getWidgetLoader: () => AtlasWidgetLoader | undefined;
}): AtlasOverlayController {
  return {
    async openModal<TResult>(request: AtlasModalRequest<TResult>): Promise<TResult | undefined> {
      const content = createOverlayContentMount(request.content, options.getWidgetLoader);
      try {
        return await (options.providers.openModal?.(request, content) ?? Promise.resolve(undefined));
      } finally {
        await content?.unmount();
      }
    },
    openPopup(request) {
      const content = createOverlayContentMount(request.content, options.getWidgetLoader);
      const popupRef = options.providers.openPopup?.(request, content);
      if (!popupRef) throw new Error("This Atlas host has not configured a popup provider.");
      return createManagedPopupRef(popupRef, content);
    }
  };
}

function createManagedPopupRef(ref: AtlasPopupRef, content: AtlasOverlayContentMount | undefined): AtlasPopupRef {
  let closed = false;

  const cleanup = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    await content?.unmount();
  };

  void ref.closed?.then(cleanup, cleanup);

  return {
    id: ref.id,
    ...(ref.closed ? { closed: ref.closed.then(cleanup) } : {}),
    ...(ref.update ? { update: ref.update.bind(ref) } : {}),
    async close() {
      if (closed) return;
      try {
        await ref.close();
      } finally {
        await cleanup();
      }
    }
  };
}
