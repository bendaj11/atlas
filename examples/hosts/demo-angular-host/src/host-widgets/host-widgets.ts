import { Component, signal } from '@angular/core';
import { injectAtlasSdk, WidgetOutlet } from '@atlas/sdk/angular';

@Component({
  selector: 'atlas-host-widgets',
  standalone: true,
  imports: [WidgetOutlet],
  template: `
    <section aria-label="Host widgets">
      <h2>Host widgets</h2>
      <button (click)="showReact.set(!showReact())">
        {{ showReact() ? 'Hide React widget' : 'Show React widget' }}
      </button>
      <button (click)="updateReactWidget()">Update React widget</button>
      <button (click)="showAngular.set(!showAngular())">
        {{ showAngular() ? 'Hide Angular widget' : 'Show Angular widget' }}
      </button>
      <button (click)="updateAngularWidget()">Update Angular widget</button>
      @if (showReact()) {
        <section
          aria-label="React widget"
          [atlasWidget]="reactWidget()"
        ></section>
      }
      @if (showAngular()) {
        <section
          aria-label="Angular widget"
          [atlasWidget]="angularWidget()"
        ></section>
      }
    </section>
  `,
})
export class HostWidgets {
  private readonly atlas = injectAtlasSdk();
  readonly showReact = signal(false);
  readonly showAngular = signal(false);
  readonly reactWidget = signal(
    this.atlas.getWidget('6f4994c1-b95f-4b24-a01a-106dd61aa4fb', {
      inputs: { count: 12 },
    }),
  );
  readonly angularWidget = signal(
    this.atlas.getWidget('98abc74d-a11f-4eca-8255-c6f2f49e3d6e', {
      inputs: { status: 'pending' },
    }),
  );

  updateReactWidget(): void {
    this.reactWidget.set(
      this.atlas.getWidget('6f4994c1-b95f-4b24-a01a-106dd61aa4fb', {
        inputs: { count: 24 },
      }),
    );
  }

  updateAngularWidget(): void {
    this.angularWidget.set(
      this.atlas.getWidget('98abc74d-a11f-4eca-8255-c6f2f49e3d6e', {
        inputs: { status: 'paid' },
      }),
    );
  }
}
