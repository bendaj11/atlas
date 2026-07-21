import type { DomRuntimeOptions } from "./dom-host-options.js";
import type { AtlasHostNavigationItem } from "./host-navigation.js";
import type { AtlasHostMountEvent } from "./index.js";

export function renderHostNavigation(document: Document, items: readonly AtlasHostNavigationItem[]): void {
  const nav = document.querySelector<HTMLElement>("[data-atlas-navigation]");
  if (!nav) return;
  nav.replaceChildren(...items.map((item) => {
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.label;
    if (item.active) link.setAttribute("aria-current", "page");
    link.addEventListener("click", (event) => {
      event.preventDefault();
      item.navigate();
    });
    return link;
  }));
}

export function renderHostMountState(
  document: Document,
  event: AtlasHostMountEvent,
  retry: () => void,
  options: DomRuntimeOptions
): void {
  const container = findMountContainer(document, event);
  if (!container) return;
  container.dataset.atlasState = event.state;
  container.dataset.atlasAppId = event.manifest.id;
  container.setAttribute("aria-busy", event.state === "loading" ? "true" : "false");

  const existingStatus = container.querySelector<HTMLElement>(":scope > [data-atlas-placement-status]");
  if (event.state === "mounting" || event.state === "mounted") existingStatus?.remove();
  if (event.state === "loading") renderLoadingState(document, container, event, existingStatus, options);
  if (event.state === "error") renderErrorState(document, container, event, retry, existingStatus, options);
  if (event.state === "unmounted") {
    container.replaceChildren();
    delete container.dataset.atlasAppId;
  }
}

export function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function findMountContainer(document: Document, event: AtlasHostMountEvent): HTMLElement | null {
  if (event.placement.kind === "route") {
    return document.querySelector<HTMLElement>("[data-atlas-route-outlet]");
  }

  return document.querySelector<HTMLElement>(`[data-atlas-slot-mount="${cssEscape(`${event.manifest.id}:${event.placement.id}`)}"]`)
    ?? document.querySelector<HTMLElement>(`[data-atlas-slot="${cssEscape(event.placement.slot!)}"]`);
}

function renderLoadingState(
  document: Document,
  container: HTMLElement,
  event: AtlasHostMountEvent,
  existingStatus: HTMLElement | null,
  options: DomRuntimeOptions
): void {
  if (options.renderLoading) {
    options.renderLoading(container, event);
    return;
  }
  const status = prepareStatusElement(document, container, existingStatus, "status");
  const label = document.createElement("span");
  label.textContent = `Loading ${event.manifest.name}...`;
  status.append(label);
}

function renderErrorState(
  document: Document,
  container: HTMLElement,
  event: AtlasHostMountEvent,
  retry: () => void,
  existingStatus: HTMLElement | null,
  options: DomRuntimeOptions
): void {
  if (options.renderError) {
    options.renderError(container, event, retry);
    return;
  }
  const status = prepareStatusElement(document, container, existingStatus, "alert");
  const message = document.createElement("span");
  message.textContent = `Unable to load ${event.manifest.name}. `;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Retry";
  button.addEventListener("click", retry);
  status.append(message, button);
}

function prepareStatusElement(
  document: Document,
  container: HTMLElement,
  existingStatus: HTMLElement | null,
  role: "status" | "alert"
): HTMLElement {
  const status = existingStatus ?? document.createElement("div");
  status.dataset.atlasStatus = "";
  status.dataset.atlasPlacementStatus = "";
  status.setAttribute("role", role);
  status.replaceChildren();
  if (!existingStatus) container.prepend(status);
  return status;
}
