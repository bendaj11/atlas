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
  const clearStatus = () => {
    disposeStatus?.();
    disposeStatus = undefined;

    element.replaceChildren();
  };

  return {
    element,
    clearStatus,
    showLoading() {
      clearStatus();

      if (input.renderLoading) {
        disposeStatus = input.renderLoading(element) || undefined;

        return;
      }

      if (input.options.renderWidgetLoading) {
        disposeStatus =
          input.options.renderWidgetLoading(element, input.context) ||
          undefined;

        return;
      }

      element.append(
        createStatusElement(document, 'status', 'Loading widget...'),
      );
    },
    showError({ error, retry, resolved }) {
      clearStatus();

      const context = {
        ...createWidgetRenderContext(input.context.widgetId, resolved),
        error,
      };

      if (input.options.renderWidgetError) {
        disposeStatus =
          input.options.renderWidgetError(element, context, retry) || undefined;

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
      element.append(status);
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
