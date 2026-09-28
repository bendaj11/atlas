import { createLoaderElement } from '../shared/loader.js';
import type {
  AtlasResolvedWidget,
  AtlasWidgetRenderContext,
  DisposeRenderer,
  WidgetCard,
  WidgetCardInput,
} from './widget-loader.types.js';

export function createWidgetCard(input: WidgetCardInput): WidgetCard {
  const document = input.parent.ownerDocument ?? globalThis.document;

  if (!document?.createElement) {
    return {
      element: input.parent,
      clearStatus() {},
      showLoading() {},
      showError() {},
      remove() {},
    };
  }

  const element = document.createElement('section');
  element.dataset.atlasWidgetCard = input.context.widgetId;

  input.parent.append(element);

  let disposeStatus: DisposeRenderer | undefined;
  let statusElement: HTMLElement | undefined;
  let loading = false;
  const clearStatus = () => {
    disposeStatus?.();
    disposeStatus = undefined;
    loading = false;

    statusElement?.remove();
    statusElement = undefined;
  };
  const createStatusOutlet = () => {
    clearStatus();

    statusElement = document.createElement('div');
    statusElement.style.display = 'contents';

    element.prepend(statusElement);

    return statusElement;
  };

  return {
    element,
    clearStatus,
    showLoading() {
      if (loading) return;

      const outlet = createStatusOutlet();
      loading = true;

      if (input.renderLoading) {
        disposeStatus = input.renderLoading(outlet) || undefined;

        return;
      }

      if (input.options.renderWidgetLoading) {
        disposeStatus =
          input.options.renderWidgetLoading(outlet, input.context) || undefined;

        return;
      }

      outlet.append(createLoaderElement({ document, label: 'Loading widget' }));
    },
    showError({ error, retry, resolved }) {
      const outlet = createStatusOutlet();
      const context = {
        ...createWidgetRenderContext(input.context.widgetId, resolved),
        error,
      };

      if (input.options.renderWidgetError) {
        disposeStatus =
          input.options.renderWidgetError(outlet, context, retry) || undefined;

        return;
      }

      const status = createStatusElement(
        document,
        'alert',
        `Unable to load widget. ${error.message} `,
      );
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Retry';

      button.addEventListener('click', retry, { once: true });
      status.append(button);
      outlet.append(status);
    },
    remove() {
      clearStatus();
      element.remove();
    },
  };
}

function createStatusElement(
  document: Document,
  role: 'status' | 'alert',
  text: string,
): HTMLElement {
  const status = document.createElement('div');
  status.dataset.atlasStatus = '';

  status.setAttribute('role', role);

  const message = document.createElement('span');
  message.textContent = text;

  status.append(message);

  return status;
}

export function createWidgetRenderContext(
  widgetId: string,
  resolved?: AtlasResolvedWidget,
): AtlasWidgetRenderContext {
  return {
    widgetId,
    ...(resolved
      ? { widget: resolved.widget, ownerManifest: resolved.ownerManifest }
      : {}),
  };
}
