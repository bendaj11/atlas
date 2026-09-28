import '@angular/compiler';
import { faker } from '@faker-js/faker';
import {
  Component,
  provideZonelessChangeDetection,
  type ApplicationRef,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type { AtlasHostAnchorKind } from '../dom-host/host-anchors.types.js';
import {
  ATLAS_NOT_FOUND_COMPONENT,
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
  selector: 'atlas-test-not-found',
  standalone: true,
  template: '<p data-testid="host-not-found"></p>',
})
class HostNotFound {}

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
  private notFoundComponent = faker.datatype.boolean();

  constructor() {
    document.body.replaceChildren(this.root);
  }

  readonly given = {
    notFoundComponent: (notFoundComponent: boolean) => {
      this.notFoundComponent = notFoundComponent;

      return this;
    },
  };

  readonly when = {
    bootstrapped: async () => {
      this.app = await bootstrapApplication(AnchorsRoot, {
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          ...(this.notFoundComponent
            ? [{ provide: ATLAS_NOT_FOUND_COMPONENT, useValue: HostNotFound }]
            : []),
        ],
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
    routeNotFoundSet: (routeNotFound: boolean) => {
      this.anchors!.setRouteNotFound(routeNotFound);
      this.app!.tick();
    },
    destroyed: () => {
      this.app!.destroy();
    },
  };

  readonly get = {
    anchorTag: (kind: Exclude<AtlasHostAnchorKind, 'slot'>) =>
      this.anchors!.get(kind)?.tagName,
    routeOutletParentTag: () =>
      this.anchors!.get('route-outlet')?.parentElement?.tagName,
    hostNotFoundPresent: () =>
      this.root.querySelector('[data-testid="host-not-found"]') !== null,
    defaultNotFoundPresent: () =>
      this.root.querySelector('[data-atlas-not-found]') !== null,
    slotTag: () => this.anchors!.get('slot', SLOT_ID)?.tagName,
    layoutChildTags: () =>
      [
        ...this.root.querySelectorAll(
          'atlas-navigation, atlas-slot, atlas-route-outlet',
        ),
      ].map((element) => element.tagName),
  };
}
