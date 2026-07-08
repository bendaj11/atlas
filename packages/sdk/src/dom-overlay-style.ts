import type { AtlasPopupBounds } from "./host-overlays.js";

export function createPopupBar(
  document: Document,
  popup: HTMLElement,
  title: string | undefined,
  draggable: boolean,
  close: () => void
): HTMLElement {
  const bar = document.createElement("header");
  bar.dataset.atlasPopupBar = "";
  Object.assign(bar.style, popupBarStyle(draggable));

  const label = document.createElement("strong");
  label.textContent = title ?? "Popup";

  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", "Close popup");
  button.textContent = "\u00d7";
  button.addEventListener("click", close);

  bar.append(label, button);
  if (draggable) enableDrag(document, popup, bar, button);
  return bar;
}

export function styleOverlay(element: HTMLElement, kind: "popup", title?: string): void {
  element.dataset.atlasOverlay = kind;
  element.setAttribute("aria-label", title ?? kind);
  Object.assign(element.style, overlayStyle);
  Object.assign(element.style, popupStyle);
}

export function applyBounds(element: HTMLElement, bounds?: AtlasPopupBounds): void {
  if (!bounds) return;
  if (bounds.x !== undefined) element.style.left = `${bounds.x}px`;
  if (bounds.y !== undefined) element.style.top = `${bounds.y}px`;
  if (bounds.width !== undefined) element.style.width = `${bounds.width}px`;
  if (bounds.height !== undefined) element.style.height = `${bounds.height}px`;
}

const overlayStyle = {
  boxSizing: "border-box",
  background: "Canvas",
  color: "CanvasText",
  border: "1px solid GrayText",
  padding: "1rem",
  maxWidth: "calc(100vw - 2rem)",
  maxHeight: "calc(100vh - 2rem)",
  overflow: "auto"
};

const popupStyle = {
  position: "fixed",
  zIndex: "1000",
  minWidth: "16rem",
  minHeight: "8rem"
};

function popupBarStyle(draggable: boolean): Partial<CSSStyleDeclaration> {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: ".75rem",
    cursor: draggable ? "move" : "default",
    userSelect: "none"
  };
}

function enableDrag(document: Document, popup: HTMLElement, bar: HTMLElement, button: HTMLElement): void {
  bar.addEventListener("pointerdown", (event) => {
    if (event.target === button) return;

    const rect = popup.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const move = (next: PointerEvent): void => {
      popup.style.left = `${next.clientX - offsetX}px`;
      popup.style.top = `${next.clientY - offsetY}px`;
    };

    const stop = (): void => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop, { once: true });
  });
}
