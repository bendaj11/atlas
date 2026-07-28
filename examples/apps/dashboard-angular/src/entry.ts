import 'zone.js';
import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
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
    <h1>Dashboard Angular</h1>
    <p>Mounted at {{ context.basePath }}</p>
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
  readonly context = injectAtlasAppContext();
  private readonly sdk = injectAtlasSdk();
  readonly externalProductCount = this.sdk.getWidget<{
    count: number;
    label: string;
  }>('55ca3323-c62f-44de-9194-6ab42375e578', {
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
  const app = await bootstrapApplication(AtlasAppRootComponent, {
    providers: [provideAtlasAppContext(context), provideAtlasSdk(sdk)],
  });
  return {
    unmount() {
      app.destroy();
      element.remove();
    },
  };
});
