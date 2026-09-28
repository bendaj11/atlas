import { createComponent, type Type } from '@angular/core';
import type { DomHostUiRenderers } from '../dom-host/dom-host.types.js';
import type { DisposeRenderer } from '../widget-loader/widget-loader.types.js';
import type {
  AngularErrorInputs,
  AngularHostUiRenderersInput,
} from './angular-host-ui.types.js';

export function createAngularHostUiRenderers(
  input: AngularHostUiRenderersInput,
): DomHostUiRenderers {
  const { components, applicationRef } = input;
  const {
    loadingComponent,
    errorComponent,
    widgetLoadingComponent,
    widgetErrorComponent,
    hostErrorComponent,
  } = components;
  const render = (
    component: Type<unknown>,
    status: HTMLElement,
    inputs?: AngularErrorInputs,
  ): DisposeRenderer => {
    const hostElement = status.appendChild(
      status.ownerDocument.createElement('div'),
    );
    const reference = createComponent(component, {
      environmentInjector: applicationRef.injector,
      hostElement,
    });

    if (inputs) {
      reference.setInput('error', inputs.error);
      reference.setInput('retry', inputs.retry);
    }

    applicationRef.attachView(reference.hostView);
    reference.changeDetectorRef.detectChanges();

    return () => {
      applicationRef.detachView(reference.hostView);
      reference.destroy();
      hostElement.remove();
    };
  };
  const renderers: DomHostUiRenderers = {};

  if (loadingComponent)
    renderers.renderLoading = (status) => render(loadingComponent, status);

  if (errorComponent)
    renderers.renderError = (status, event, retry) =>
      render(errorComponent, status, { error: event.error, retry });

  if (widgetLoadingComponent)
    renderers.renderWidgetLoading = (status) =>
      render(widgetLoadingComponent, status);

  if (widgetErrorComponent)
    renderers.renderWidgetError = (status, context, retry) =>
      render(widgetErrorComponent, status, { error: context.error, retry });

  if (hostErrorComponent)
    renderers.renderHostError = (status, error, retry) =>
      render(hostErrorComponent, status, { error, retry });

  return renderers;
}
