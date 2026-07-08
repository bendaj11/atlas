import type { AtlasModalControls, AtlasModalRef, AtlasModalRequest, AtlasPopupRef, AtlasPopupRequest } from "./host-overlays.js";
import { applyBounds, createPopupBar, styleOverlay } from "./dom-overlay-style.js";
import { renderOverlayContent } from "./overlay-content.js";
import type { AtlasOverlayContentMount, AtlasOverlayProviders } from "./overlay-types.js";

/** A dependency-free default. Hosts can replace either provider with Ionic, CDK, Bootstrap, or another UI system. */
export function createDomOverlayProviders(document: Document): Required<AtlasOverlayProviders> {
  return {
    openModal<TResult, TProps extends object>(
      request: AtlasModalRequest<TResult, TProps>,
      _controls: AtlasModalControls<TResult>,
      content?: AtlasOverlayContentMount
    ): AtlasModalRef<TResult> {
      const dialog = document.createElement("dialog");
      const closed = createSettledPromise<TResult | undefined>();
      const closeDialog = (result: TResult | undefined): void => {
        closed.resolve(result);
        removeDialog(dialog);
      };

      styleOverlay(dialog, "modal");
      dialog.addEventListener("close", () => closeDialog(undefined), { once: true });
      document.body.append(dialog);
      void renderOverlayContent(request.component, createOutlet(document, dialog), content)
        .then(() => dialog.showModal())
        .catch((error) => {
          removeDialog(dialog);
          closed.reject(error);
        });

      return {
        id: request.id ?? createOverlayId("modal"),
        closed: closed.promise,
        close: closeDialog,
        dismiss: () => closeDialog(undefined)
      };
    },
    openPopup(request: AtlasPopupRequest, content?: AtlasOverlayContentMount): AtlasPopupRef {
      const popup = createPopupElement(document, request);
      const closed = createClosedPromise();
      const close = (): void => {
        popup.remove();
        closed.resolve();
      };

      popup.append(createPopupBar(document, popup, request.title, request.draggable !== false, close));
      const outlet = createOutlet(document, popup);
      document.body.append(popup);
      void renderOverlayContent(request.content, outlet, content).catch((error) => renderError(document, outlet, error));

      return {
        id: request.id ?? createOverlayId("popup"),
        closed: closed.promise,
        close,
        update(bounds) {
          applyBounds(popup, bounds);
        }
      };
    }
  };
}

function createPopupElement(document: Document, request: AtlasPopupRequest): HTMLElement {
  const popup = document.createElement("section");
  popup.dataset.atlasPopup = request.id ?? "";
  popup.setAttribute("role", "dialog");
  styleOverlay(popup, "popup", request.title);
  applyBounds(popup, request.bounds);
  if (request.resizable !== false) popup.style.resize = "both";
  return popup;
}

function createClosedPromise(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function createSettledPromise<TValue>(): {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
  reject: (error: unknown) => void;
} {
  let resolve: (value: TValue) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<TValue>((next, fail) => {
    resolve = next;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function createOutlet(document: Document, parent: HTMLElement): HTMLElement {
  const outlet = document.createElement("div");
  outlet.dataset.atlasOverlayOutlet = "";
  parent.append(outlet);
  return outlet;
}

function createOverlayId(kind: "modal" | "popup"): string {
  return `atlas-${kind}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function removeDialog(dialog: HTMLDialogElement): void {
  if (dialog.open) dialog.close();
  dialog.remove();
}

function renderError(document: Document, outlet: HTMLElement, value: unknown): void {
  const error = value instanceof Error ? value : new Error(String(value));
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = `Unable to load overlay content: ${error.message}`;
  outlet.replaceChildren(message);
}
