import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/angular';
import { HostWidgets } from './host-widgets/host-widgets';

@Component({
  selector: 'atlas-host-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AtlasHostLayout,
    AtlasHostStatus,
    AtlasNavigation,
    AtlasRouteOutlet,
    AtlasSlot,
    HostWidgets,
  ],
  template: `<ng-container *atlasHostLayout="'default'"
      ><atlas-host-status />
      <header><strong>Atlas</strong><atlas-slot slotId="header" /></header>
      <atlas-navigation
        aria-label="Application" /><atlas-host-widgets /><atlas-route-outlet /></ng-container
    ><router-outlet hidden />`,
})
export class AppComponent {}
