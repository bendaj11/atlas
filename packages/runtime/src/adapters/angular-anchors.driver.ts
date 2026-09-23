import '@angular/compiler';
import {
  Component,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import type { AtlasHostAnchorKind } from '../dom-host/host-anchors.types.js';
import {
  AtlasAngularHostAnchors,
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from './angular-anchors.js';

const LAYOUT_ID = 'main';
const SLOT_ID = 'header';

@Component({
  selector: 'atlas-anchors-root',
  standalone: true,
  imports: [
    AtlasHostLayout,
    AtlasHostStatus,
    AtlasNavigation,
    AtlasRouteOutlet,
    AtlasSlot,
  ],
  template: `
    <atlas-host-status></atlas-host-status>
    <ng-container *atlasHostLayout="'${LAYOUT_ID}'">
      <atlas-navigation></atlas-navigation>
      <atlas-slot slotId="${SLOT_ID}"></atlas-slot>
      <atlas-route-outlet></atlas-route-outlet>
    </ng-container>
  `,
})
class AnchorsRoot {}

export class AngularAnchorsDriver {
  private readonly root = document.createElement('atlas-anchors-root');
  private app: ApplicationRef | undefined;
  private anchors: AtlasAngularHostAnchors | undefined;

  constructor() {
    document.body.replaceChildren(this.root);
  }

  readonly when = {
    bootstrapped: async () => {
      this.app = await bootstrapApplication(AnchorsRoot, {
        providers: [provideZonelessChangeDetection()],
      });
      this.anchors = this.app.injector.get(AtlasAngularHostAnchors);

      this.app.tick();
    },
    layoutActivated: () => {
      this.anchors!.setActiveLayout(LAYOUT_ID);
      this.app!.tick();
    },
    layoutDeactivated: () => {
      this.anchors!.setActiveLayout(undefined);
      this.app!.tick();
    },
    destroyed: () => {
      this.app!.destroy();
    },
  };

  readonly get = {
    anchorTag: (kind: Exclude<AtlasHostAnchorKind, 'slot'>) =>
      this.anchors!.get(kind)?.tagName,
    slotTag: () => this.anchors!.get('slot', SLOT_ID)?.tagName,
    layoutChildTags: () =>
      [
        ...this.root.querySelectorAll(
          'atlas-navigation, atlas-slot, atlas-route-outlet',
        ),
      ].map((element) => element.tagName),
  };
}
