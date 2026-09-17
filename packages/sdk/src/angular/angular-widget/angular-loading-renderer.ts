import {
  createComponent,
  type ApplicationRef,
  type EnvironmentInjector,
  type Type,
} from '@angular/core';
import type { AtlasWidgetLoadingRenderer } from '../../host.js';

export interface AngularLoadingRendererRequest {
  readonly loadingComponent: Type<unknown>;
  readonly applicationRef: ApplicationRef;
  readonly environmentInjector: EnvironmentInjector;
}

/** Renders an Angular component into the widget container while the host reports loading. */
export function createAngularLoadingRenderer(
  request: AngularLoadingRendererRequest,
): AtlasWidgetLoadingRenderer {
  const { loadingComponent, applicationRef, environmentInjector } = request;

  return (container) => {
    const hostElement = container.ownerDocument.createElement('div');
    container.append(hostElement);

    const component = createComponent(loadingComponent, {
      environmentInjector,
      hostElement,
    });
    applicationRef.attachView(component.hostView);
    component.changeDetectorRef.detectChanges();

    return () => {
      applicationRef.detachView(component.hostView);
      component.destroy();
      hostElement.remove();
    };
  };
}
