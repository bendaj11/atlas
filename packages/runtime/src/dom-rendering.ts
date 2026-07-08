import type { AtlasManifest } from "@atlas/schema";
import type { AtlasNavigation } from "@atlas/sdk/navigation";
import type { DomHostOptions } from "./dom-host-options.js";
import type { AtlasHostMountEvent } from "./index.js";

export function renderHostNavigation(document: Document, manifests: AtlasManifest[], hostId: string, navigation: AtlasNavigation): void {
  const nav = document.querySelector<HTMLElement>("[data-atlas-navigation]");
  if (!nav) return;
  nav.replaceChildren(...routePlacementsForHost(manifests, hostId).map((placement) => {
    const route = placement.route!;
    const link = document.createElement("a");
    link.href = navigation.createHref(route.basePath);
    link.textContent = route.nav?.label ?? route.title;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigation.navigate(route.basePath);
    });
    return link;
  }));
}

export function renderHostMountState(
  document: Document,
  event: AtlasHostMountEvent,
  retry: () => void,
  options: DomHostOptions
): void {
  const container = findMountContainer(document, event);
  if (!container) return;
  container.dataset.atlasState = event.state;
  container.setAttribute("aria-busy", event.state === "loading" ? "true" : "false");

  const existingStatus = container.querySelector<HTMLElement>("[data-atlas-status]");
  if (event.state === "mounting" || event.state === "mounted") existingStatus?.remove();
  if (event.state === "loading") renderLoadingState(document, container, event, existingStatus, options);
  if (event.state === "error") renderErrorState(document, container, event, retry, existingStatus, options);
  if (event.state === "unmounted") container.replaceChildren();
}

export function cssEscape(value: string): string {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
}

function routePlacementsForHost(manifests: AtlasManifest[], hostId: string): AtlasManifest["placements"] {
  return manifests
    .flatMap((manifest) => manifest.placements)
    .filter((placement) => placement.hostId === hostId && placement.kind === "route" && placement.route?.nav?.visible !== false)
    .sort((left, right) => (left.route?.nav?.order ?? 0) - (right.route?.nav?.order ?? 0));
}

function findMountContainer(document: Document, event: AtlasHostMountEvent): HTMLElement | null {
  const selector = event.placement.kind === "route"
    ? "[data-atlas-route-outlet]"
    : `[data-atlas-slot="${cssEscape(event.placement.slot!)}"]`;
  return document.querySelector<HTMLElement>(selector);
}

function renderLoadingState(
  document: Document,
  container: HTMLElement,
  event: AtlasHostMountEvent,
  existingStatus: HTMLElement | null,
  options: DomHostOptions
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
  options: DomHostOptions
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
  status.setAttribute("role", role);
  status.replaceChildren();
  if (!existingStatus) container.prepend(status);
  return status;
}
