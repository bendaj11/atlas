export interface AtlasHostUiOptions {
  document: Document;
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
  const container = options.document.querySelector<HTMLElement>("[data-atlas-host-status]");
  let disposeRenderer: (() => void) | undefined;

  const clear = (): void => {
    disposeRenderer?.();
    disposeRenderer = undefined;
    container?.replaceChildren();
    container?.removeAttribute("data-atlas-state");
    container?.removeAttribute("aria-busy");
  };

  return {
    showLoading() {
      if (!container) return;
      clear();
      setHostState(container, "loading");
      if (options.renderHostLoading) {
        disposeRenderer = options.renderHostLoading(container) || undefined;
        return;
      }
      renderDefaultLoading(options.document, container);
    },
    showError(error, retry) {
      if (!container) return;
      clear();
      setHostState(container, "error");
      if (options.renderHostError) {
        disposeRenderer = options.renderHostError(container, error, retry) || undefined;
        return;
      }
      renderDefaultError(options.document, container, retry);
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
