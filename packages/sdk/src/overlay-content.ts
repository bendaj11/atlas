import type { AtlasWidgetContent } from "./host-overlays.js";
import type { AtlasMountedWidget, AtlasWidgetLoader } from "./lifecycle.js";
import type { AtlasOverlayContentMount } from "./overlay-types.js";
import { sdkError } from "./sdk-error.js";

export function createOverlayContentMount(
  value: unknown,
  getLoader: () => AtlasWidgetLoader | undefined,
  injectedProps?: Record<string, unknown>
): AtlasOverlayContentMount | undefined {
  if (!isWidgetContent(value)) return undefined;

  let mounted: AtlasMountedWidget | undefined;
  let disposed = false;

  return {
    kind: "widget",
    widget: value.widget,
    async mount(container) {
      if (mounted) {
        throw sdkError(
          `Atlas cannot mount widget "${value.widget}" because this overlay already contains it.`,
          {
            suggestedActions: "Close or unmount the existing overlay content before mounting the widget again.",
            code: "ATLAS_OVERLAY_WIDGET_ALREADY_MOUNTED"
          }
        );
      }

      const loader = getLoader();
      if (!loader) {
        throw sdkError(
          `Atlas cannot load widget "${value.widget}" because the host widget loader is not ready.`,
          {
            suggestedActions: "Wait for the Atlas host to finish starting before opening this overlay.",
            code: "ATLAS_WIDGET_LOADER_NOT_READY"
          }
        );
      }

      const next = await loader.mount(value.widget, container, {
        ...(value.props ?? {}),
        ...(injectedProps ?? {})
      });
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
