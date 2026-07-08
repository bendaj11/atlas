import type { AtlasModalRequest, AtlasPopupRef, AtlasPopupRequest } from "./host-overlays.js";
import { applyBounds, createPopupBar, styleOverlay } from "./dom-overlay-style.js";
import { renderOverlayContent } from "./overlay-content.js";
import type { AtlasOverlayContentMount, AtlasOverlayProviders } from "./overlay-types.js";

/** A dependency-free default. Hosts can replace either provider with Ionic, CDK, Bootstrap, or another UI system. */
export function createDomOverlayProviders(document: Document): Required<AtlasOverlayProviders> {
  return {
    openModal<TResult>(request: AtlasModalRequest<TResult>, content?: AtlasOverlayContentMount): Promise<TResult | undefined> {
      return new Promise((resolve, reject) => {
        const dialog = document.createElement("dialog");
        styleOverlay(dialog, "modal", request.title);

        const outlet = createOutlet(document, dialog);
        const finish = (): void => {
          dialog.remove();
          resolve(undefined);
        };

        dialog.addEventListener("close", finish, { once: true });
        document.body.append(dialog);
        renderOverlayContent(request.content, outlet, content)
          .then(() => dialog.showModal())
          .catch((error) => {
            dialog.remove();
            reject(error);
          });
      });
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
        id: request.id ?? createPopupId(),
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

function createOutlet(document: Document, parent: HTMLElement): HTMLElement {
  const outlet = document.createElement("div");
  outlet.dataset.atlasOverlayOutlet = "";
  parent.append(outlet);
  return outlet;
}

function createPopupId(): string {
  return `atlas-popup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderError(document: Document, outlet: HTMLElement, value: unknown): void {
  const error = value instanceof Error ? value : new Error(String(value));
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = `Unable to load overlay content: ${error.message}`;
  outlet.replaceChildren(message);
}
