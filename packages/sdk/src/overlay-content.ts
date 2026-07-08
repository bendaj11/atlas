import type { AtlasWidgetContent } from "./host-overlays.js";
import type { AtlasMountedWidget, AtlasWidgetLoader } from "./lifecycle.js";
import type { AtlasOverlayContentMount } from "./overlay-types.js";

export function createOverlayContentMount(
  value: unknown,
  getLoader: () => AtlasWidgetLoader | undefined
): AtlasOverlayContentMount | undefined {
  if (!isWidgetContent(value)) return undefined;

  let mounted: AtlasMountedWidget | undefined;
  let disposed = false;

  return {
    kind: "widget",
    widget: value.widget,
    async mount(container) {
      if (mounted) throw new Error(`Atlas widget "${value.widget}" is already mounted in an overlay.`);

      const loader = getLoader();
      if (!loader) throw new Error(`Atlas widget loader is not ready for overlay content "${value.widget}".`);

      const next = await loader.mount(value.widget, container, value.props ?? {});
      if (disposed) await next.unmount();
      else mounted = next;
    },
    async unmount() {
      const current = mounted;
      mounted = undefined;
      disposed = true;
      await current?.unmount();
    }
  };
}

export function isWidgetContent(value: unknown): value is AtlasWidgetContent {
  return typeof value === "object" && value !== null && typeof (value as AtlasWidgetContent).widget === "string";
}

export async function renderOverlayContent(
  value: unknown,
  outlet: HTMLElement,
  content?: AtlasOverlayContentMount
): Promise<void> {
  if (content) {
    await content.mount(outlet);
    return;
  }

  if (typeof Node !== "undefined" && value instanceof Node) {
    outlet.append(value);
    return;
  }

  if (typeof value === "string") {
    outlet.textContent = value;
  }
}
