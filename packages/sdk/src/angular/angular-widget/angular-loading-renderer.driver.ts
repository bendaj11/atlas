import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import type { AtlasWidgetLoadingRenderer } from '../../host.js';
import { createAngularLoadingRenderer } from './angular-loading-renderer.js';

@Component({
  selector: 'atlas-widget-skeleton',
  standalone: true,
  template: '<output aria-label="Widget loading">loading</output>',
})
class WidgetSkeleton {}

export class AngularLoadingRendererDriver {
  private readonly container = document.createElement('div');
  private renderLoading!: AtlasWidgetLoadingRenderer;
  private hide: (() => void) | undefined;

  readonly when = {
    rendererCreated: async (): Promise<void> => {
      const application = await createApplication({
        providers: [provideZonelessChangeDetection()],
      });

      this.renderLoading = createAngularLoadingRenderer({
        loadingComponent: WidgetSkeleton,
        applicationRef: application,
        environmentInjector: application.injector,
      });
    },
    loadingShown: (): void => {
      this.hide = this.renderLoading(this.container) ?? undefined;
    },
    loadingHidden: (): void => {
      this.hide?.();
    },
  };

  readonly get = {
    containerHtml: (): string => this.container.innerHTML,
  };
}
