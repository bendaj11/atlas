import {
  createComponent,
  type ApplicationConfig,
  type ComponentRef,
  type Type,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import type { AtlasExportedWidgetEntry } from '../../lifecycle.js';
import { defineExportedWidget } from './define-app.js';
import { provideAtlasApp } from './provide-atlas-app.js';

/** Boots a standalone Angular component as an exported widget; each mount owns its own application. */
export function createExportedWidget<TProps extends object>(
  componentType: Type<unknown>,
  config: ApplicationConfig = { providers: [] },
): AtlasExportedWidgetEntry<TProps> {
  return defineExportedWidget(
    async ({ props, sdk, context, styleTarget, container }) => {
      const application = await createApplication({
        ...config,
        providers: [
          provideAtlasApp({ context, sdk, styleTarget }),
          ...config.providers,
        ],
      });

      const component = createComponent(componentType, {
        environmentInjector: application.injector,
        hostElement: container,
      });
      application.attachView(component.hostView);
      applyInputs(component, props);

      return {
        setInputs(inputs: TProps) {
          applyInputs(component, inputs);
        },
        unmount() {
          application.detachView(component.hostView);
          component.destroy();
          application.destroy();
        },
      };
    },
  );
}

function applyInputs(component: ComponentRef<unknown>, inputs: object): void {
  for (const [name, value] of Object.entries(inputs)) {
    component.setInput(name, value);
  }

  component.changeDetectorRef.detectChanges();
}
