import 'zone.js';
import { Component, signal } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { createComponent } from '@angular/core';
import {
  defineApp,
  injectAtlasAppContext,
  injectAtlasSdk,
  provideAtlasAppContext,
  provideAtlasSdk,
  WidgetOutlet,
} from '@atlas/sdk/angular';

@Component({
  selector: 'atlas-dashboard-angular-root',
  standalone: true,
  imports: [WidgetOutlet],
  template: `
    <h1>{{ heading() }}</h1>
    <p>Mounted at {{ context.path }}</p>
    <section
      aria-label="External React product count"
      [atlasWidget]="externalProductCount"
    ></section>
    <section
      aria-label="Internal React product count"
      [atlasWidget]="internalProductCount"
    ></section>
  `,
})
class AtlasAppRootComponent {
  readonly heading = signal('Dashboard Angular');
  readonly context = injectAtlasAppContext();
  private readonly sdk = injectAtlasSdk();
  readonly externalProductCount = this.sdk.getWidget<{
    count: number;
    label: string;
  }>('6f4994c1-b95f-4b24-a01a-106dd61aa4fb', {
    inputs: { count: 24, label: 'External products' },
  });
  readonly internalProductCount = this.sdk.getWidget<{
    count: number;
    label: string;
  }>('6f4994c1-b95f-4b24-a01a-106dd61aa4fb', {
    inputs: { count: 12, label: 'Internal products' },
  });
}

export default defineApp(async ({ container, sdk, context }) => {
  const element = document.createElement('atlas-dashboard-angular-root');
  container.append(element);
  const app = await createApplication({
    providers: [provideAtlasAppContext(context), provideAtlasSdk(sdk)],
  });
  const component = createComponent(AtlasAppRootComponent, {
    environmentInjector: app.injector,
    hostElement: element,
  });
  app.attachView(component.hostView);
  component.changeDetectorRef.detectChanges();
  return {
    unmount() {
      app.detachView(component.hostView);
      component.destroy();
      app.destroy();
      element.remove();
    },
  };
});
