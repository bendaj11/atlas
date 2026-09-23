import '@angular/compiler';
import { faker } from '@faker-js/faker';
import {
  Component,
  Input,
  provideZonelessChangeDetection,
} from '@angular/core';
import type {
  AtlasAppMountRequest,
  AtlasExportedWidgetMountResult,
} from '../../lifecycle.js';
import { createAtlasSdk } from '../../core/sdk-factory/index.js';
import {
  anAppContext,
  anExportedWidgetManifest,
} from '../../testkit/app-context.testkit.js';
import { aMemoryNavigation } from '../../testkit/navigation.testkit.js';
import { createExportedWidget } from './create-exported-widget.js';

interface WidgetProps {
  readonly count: number;
}

@Component({
  selector: 'atlas-counter-widget',
  standalone: true,
  template: '<output aria-label="Widget count">{{ count }}</output>',
})
class CounterWidget {
  @Input() count = 0;
}

export class CreateExportedWidgetDriver {
  private readonly container = document.createElement('div');
  private readonly context = anAppContext();
  private readonly sdk = createAtlasSdk({
    hostId: faker.string.uuid(),
    navigation: aMemoryNavigation(),
  });
  private mounted: AtlasExportedWidgetMountResult<WidgetProps> | void =
    undefined;

  readonly when = {
    mounted: async (props: WidgetProps): Promise<void> => {
      const request: AtlasAppMountRequest = {
        container: this.container,
        styleTarget: this.container,
        sdk: this.sdk,
        context: this.context,
      };

      this.mounted = await createExportedWidget<WidgetProps>(CounterWidget, {
        providers: [provideZonelessChangeDetection()],
      }).mount({
        ...request,
        props,
        widget: anExportedWidgetManifest({
          ownerAppId: this.context.manifest.id,
        }),
        ownerManifest: this.context.manifest,
      });
    },
    inputsSet: (props: WidgetProps): void => {
      this.mounted?.setInputs?.(props);
    },
    unmounted: async (): Promise<void> => {
      await this.mounted?.unmount?.();
    },
  };

  readonly get = {
    renderedCount: (): string | null =>
      this.container.querySelector('output')?.textContent ?? null,
    containerHtml: (): string => this.container.innerHTML,
  };
}
