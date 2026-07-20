import { createComponent, type Type } from "@angular/core";
import type { AtlasExportedWidgetEntry, AtlasExportedWidgetMountRequest, AtlasAppEntry, AtlasAppMountRequest, AtlasAppMountResult } from "./lifecycle.js";

export interface AppBootstrap {
  (request: AtlasAppMountRequest): void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>;
}

export function defineApp(bootstrap: AppBootstrap): AtlasAppEntry {
  return {
    mount(request) {
      return bootstrap(request);
    }
  };
}

export function defineExportedWidget<TProps extends object>(
  bootstrap: (request: AtlasExportedWidgetMountRequest<TProps>) => void | AtlasAppMountResult | Promise<void | AtlasAppMountResult>
): AtlasExportedWidgetEntry<TProps> {
  return { mount: bootstrap };
}

export function createExportedWidget<TProps extends object>(
  componentType: Type<unknown>
): AtlasExportedWidgetEntry<TProps> {
  return defineExportedWidget(async ({ container, props }) => {
    const { createApplication } = await import("@angular/platform-browser");
    const application = await createApplication();
    const component = createComponent(componentType, {
      environmentInjector: application.injector,
      hostElement: container
    });
    application.attachView(component.hostView);
    for (const [name, value] of Object.entries(props)) component.setInput(name, value);
    component.changeDetectorRef.detectChanges();

    return {
      setInputs(inputs: TProps) {
        for (const [name, value] of Object.entries(inputs)) component.setInput(name, value);
        component.changeDetectorRef.detectChanges();
      },
      unmount() {
        application.detachView(component.hostView);
        component.destroy();
        application.destroy();
      }
    };
  });
}
