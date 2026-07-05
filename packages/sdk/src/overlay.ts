import type { AtlasModalRequest, AtlasPopupBounds, AtlasPopupRef, AtlasPopupRequest, AtlasWidgetContent } from "./host.js";
import type { AtlasMountedWidget, AtlasWidgetLoader } from "./lifecycle.js";

export interface AtlasOverlayContentMount {
  readonly kind: "widget";
  readonly widget: string;
  mount(container: HTMLElement): Promise<void>;
  unmount(): Promise<void>;
}

export interface AtlasOverlayProviders {
  openModal?<TResult = unknown>(request: AtlasModalRequest<TResult>, content?: AtlasOverlayContentMount): Promise<TResult | undefined>;
  openPopup?(request: AtlasPopupRequest, content?: AtlasOverlayContentMount): AtlasPopupRef;
}

export interface AtlasOverlayController extends Required<AtlasOverlayProviders> {}

/** Connects SDK overlay calls to the host's UI library and mounts catalog-selected widgets into its outlet. */
export function createAtlasOverlayController(options: {
  providers: AtlasOverlayProviders;
  getWidgetLoader: () => AtlasWidgetLoader | undefined;
}): AtlasOverlayController {
  return {
    async openModal<TResult>(request: AtlasModalRequest<TResult>): Promise<TResult | undefined> {
      const content = createContentMount(request.content, options.getWidgetLoader);
      try {
        return await (options.providers.openModal?.(request, content) ?? Promise.resolve(undefined));
      } finally {
        await content?.unmount();
      }
    },
    openPopup(request) {
      const content = createContentMount(request.content, options.getWidgetLoader);
      const ref = options.providers.openPopup?.(request, content);
      if (!ref) throw new Error("This Atlas host has not configured a popup provider.");
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
          try { await ref.close(); } finally { await cleanup(); }
        }
      };
    }
  };
}

/** A dependency-free default. Hosts can replace either provider with Ionic, CDK, Bootstrap, or another UI system. */
export function createDomOverlayProviders(document: Document): Required<AtlasOverlayProviders> {
  return {
    openModal<TResult>(request: AtlasModalRequest<TResult>, content?: AtlasOverlayContentMount): Promise<TResult | undefined> {
      return new Promise((resolve, reject) => {
        const dialog = document.createElement("dialog");
        styleOverlay(dialog, "modal", request.title);
        const outlet = createOutlet(document, dialog);
        const finish = (): void => { dialog.remove(); resolve(undefined); };
        dialog.addEventListener("close", finish, { once: true });
        document.body.append(dialog);
        renderContent(request.content, outlet, content).then(() => dialog.showModal()).catch((error) => { dialog.remove(); reject(error); });
      });
    },
    openPopup(request: AtlasPopupRequest, content?: AtlasOverlayContentMount): AtlasPopupRef {
      const popup = document.createElement("section");
      popup.dataset.atlasPopup = request.id ?? "";
      popup.setAttribute("role", "dialog");
      styleOverlay(popup, "popup", request.title);
      applyBounds(popup, request.bounds);
      if (request.resizable !== false) popup.style.resize = "both";
      let notifyClosed: () => void = () => undefined;
      const closed = new Promise<void>((resolve) => { notifyClosed = resolve; });
      const close = (): void => { popup.remove(); notifyClosed(); };
      const bar = createPopupBar(document, popup, request.title, request.draggable !== false, close);
      popup.append(bar);
      const outlet = createOutlet(document, popup);
      document.body.append(popup);
      void renderContent(request.content, outlet, content).catch((error) => renderError(document, outlet, error));
      return {
        id: request.id ?? `atlas-popup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        closed,
        close,
        update(bounds) { applyBounds(popup, bounds); }
      };
    }
  };
}

function createContentMount(value: unknown, getLoader: () => AtlasWidgetLoader | undefined): AtlasOverlayContentMount | undefined {
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

async function renderContent(value: unknown, outlet: HTMLElement, content?: AtlasOverlayContentMount): Promise<void> {
  if (content) return content.mount(outlet);
  if (typeof Node !== "undefined" && value instanceof Node) { outlet.append(value); return; }
  if (typeof value === "string") outlet.textContent = value;
}

function createOutlet(document: Document, parent: HTMLElement): HTMLElement {
  const outlet = document.createElement("div");
  outlet.dataset.atlasOverlayOutlet = "";
  parent.append(outlet);
  return outlet;
}

function createPopupBar(document: Document, popup: HTMLElement, title: string | undefined, draggable: boolean, close: () => void): HTMLElement {
  const bar = document.createElement("header");
  bar.dataset.atlasPopupBar = "";
  Object.assign(bar.style, { display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".75rem", cursor: draggable ? "move" : "default", userSelect: "none" });
  const label = document.createElement("strong");
  label.textContent = title ?? "Popup";
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Close popup");
  button.textContent = "\u00d7";
  button.addEventListener("click", close);
  bar.append(label, button);
  if (draggable) {
    bar.addEventListener("pointerdown", (event) => {
      if (event.target === button) return;
      const rect = popup.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const move = (next: PointerEvent): void => { popup.style.left = `${next.clientX - offsetX}px`; popup.style.top = `${next.clientY - offsetY}px`; };
      const stop = (): void => { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", stop); };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", stop, { once: true });
    });
  }
  return bar;
}

function styleOverlay(element: HTMLElement, kind: "modal" | "popup", title?: string): void {
  element.dataset.atlasOverlay = kind;
  element.setAttribute("aria-label", title ?? kind);
  Object.assign(element.style, { boxSizing: "border-box", background: "Canvas", color: "CanvasText", border: "1px solid GrayText", padding: "1rem", maxWidth: "calc(100vw - 2rem)", maxHeight: "calc(100vh - 2rem)", overflow: "auto" });
  if (kind === "popup") Object.assign(element.style, { position: "fixed", zIndex: "1000", minWidth: "16rem", minHeight: "8rem" });
}

function applyBounds(element: HTMLElement, bounds?: AtlasPopupBounds): void {
  if (!bounds) return;
  if (bounds.x !== undefined) element.style.left = `${bounds.x}px`;
  if (bounds.y !== undefined) element.style.top = `${bounds.y}px`;
  if (bounds.width !== undefined) element.style.width = `${bounds.width}px`;
  if (bounds.height !== undefined) element.style.height = `${bounds.height}px`;
}

function renderError(document: Document, outlet: HTMLElement, value: unknown): void {
  const error = value instanceof Error ? value : new Error(String(value));
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = `Unable to load overlay content: ${error.message}`;
  outlet.replaceChildren(message);
}
