import type { AtlasHostAnchorRegistry } from "./host-anchors.js";

export interface AtlasHostUiOptions {
  document: Document;
  anchors: AtlasHostAnchorRegistry;
  renderHostLoading?: (container: HTMLElement) => void | (() => void);
  renderHostError?: (container: HTMLElement, error: Error, retry: () => void) => void | (() => void);
}

export interface AtlasHostUi {
  showLoading(): void;
  showError(error: Error, retry: () => void): void;
  clear(): void;
}

/** Controls the single host-owned status outlet used while Atlas starts. */
export function createHostUi(options: AtlasHostUiOptions): AtlasHostUi {
  let disposeRenderer: (() => void) | undefined;
  let state: "loading" | "error" | undefined;
  let error: Error | undefined;
  let retry: (() => void) | undefined;

  const render = (): void => {
    const container = options.anchors.get("status");
    if (!container || !state) return;
    disposeRenderer?.();
    disposeRenderer = undefined;
    container.replaceChildren();
    setHostState(container, state);
    if (state === "loading") {
      if (options.renderHostLoading) {
        disposeRenderer = options.renderHostLoading(container) || undefined;
        return;
      }
      renderDefaultLoading(options.document, container);
      return;
    }
    const currentError = error!;
    const currentRetry = retry!;
    if (options.renderHostError) {
      disposeRenderer = options.renderHostError(container, currentError, currentRetry) || undefined;
      return;
    }
    renderDefaultError(options.document, container, currentRetry);
  };

  options.anchors.subscribe(render);

  const clear = (): void => {
    disposeRenderer?.();
    disposeRenderer = undefined;
    state = undefined;
    error = undefined;
    retry = undefined;
    const container = options.anchors.get("status");
    container?.replaceChildren();
    container?.removeAttribute("data-atlas-state");
    container?.removeAttribute("aria-busy");
  };

  return {
    showLoading() {
      clear();
      state = "loading";
      render();
    },
    showError(nextError, nextRetry) {
      clear();
      state = "error";
      error = nextError;
      retry = nextRetry;
      render();
    },
    clear
  };
}

function setHostState(container: HTMLElement, state: "loading" | "error"): void {
  container.dataset.atlasState = state;
  container.setAttribute("aria-busy", state === "loading" ? "true" : "false");
}

function renderDefaultLoading(document: Document, container: HTMLElement): void {
  const status = document.createElement("div");
  status.dataset.atlasStatus = "";
  status.setAttribute("role", "status");
  status.textContent = "Loading application...";
  container.replaceChildren(status);
}

function renderDefaultError(document: Document, container: HTMLElement, retry: () => void): void {
  const status = document.createElement("div");
  status.dataset.atlasStatus = "";
  status.setAttribute("role", "alert");
  const message = document.createElement("span");
  message.textContent = "Unable to start application. ";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Retry";
  button.addEventListener("click", retry);
  status.append(message, button);
  container.replaceChildren(status);
}
