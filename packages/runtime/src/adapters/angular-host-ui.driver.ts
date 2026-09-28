import '@angular/compiler';
import { jest } from '@jest/globals';
import {
  Component,
  Input,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { anAppManifest, aRoutePlacement } from '@atlas/testkit';
import type { DomHostUiRenderers } from '../dom-host/dom-host.types.js';
import type { DisposeRenderer } from '../widget-loader/widget-loader.types.js';
import { createAngularHostUiRenderers } from './angular-host-ui.js';
import type { AngularHostUiComponents } from './angular-host-ui.types.js';

@Component({ selector: 'atlas-test-root', standalone: true, template: '' })
class TestRoot {}

@Component({
  selector: 'atlas-test-loading',
  standalone: true,
  template: '<p data-testid="loading"></p>',
})
export class TestLoading {}

@Component({
  selector: 'atlas-test-error',
  standalone: true,
  template:
    '<button data-testid="retry" (click)="retry()">{{ error.message }}</button>',
})
export class TestError {
  @Input({ required: true }) error!: Error;
  @Input({ required: true }) retry!: () => void;
}

export class AngularHostUiDriver {
  private readonly status = document.createElement('div');
  private readonly retry = jest.fn<() => void>();
  private components: AngularHostUiComponents = {};
  private renderers: DomHostUiRenderers = {};
  private app: ApplicationRef | undefined;
  private dispose: DisposeRenderer | undefined;

  constructor() {
    document.body.replaceChildren(
      document.createElement('atlas-test-root'),
      this.status,
    );
  }

  readonly given = {
    components: (components: AngularHostUiComponents) => {
      this.components = components;

      return this;
    },
  };

  readonly when = {
    bootstrapped: async () => {
      this.app = await bootstrapApplication(TestRoot, {
        providers: [provideZonelessChangeDetection()],
      });
      this.renderers = createAngularHostUiRenderers({
        components: this.components,
        applicationRef: this.app,
      });
    },
    loadingRendered: () => {
      this.dispose = this.renderers.renderLoading?.(this.status, {
        manifest: anAppManifest(),
        placement: aRoutePlacement(),
        container: this.status,
        state: 'loading',
      });
    },
    hostErrorRendered: (error: Error) => {
      this.dispose = this.renderers.renderHostError?.(
        this.status,
        error,
        this.retry,
      );
    },
    retryClicked: () =>
      this.status
        .querySelector<HTMLButtonElement>('[data-testid="retry"]')!
        .click(),
    disposed: () => this.dispose?.(),
  };

  readonly get = {
    renderers: () => this.renderers,
    statusText: () => this.status.textContent,
    loadingPresent: () =>
      this.status.querySelector('[data-testid="loading"]') !== null,
    childCount: () => this.status.childElementCount,
    retryMock: () => this.retry,
    attachedViews: () => this.app!.viewCount,
  };
}
