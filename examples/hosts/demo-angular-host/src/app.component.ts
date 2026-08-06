import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { AtlasHostStatus, AtlasNavigation, AtlasRouteOutlet, AtlasSlot } from "@atlas/runtime/angular";

@Component({ selector: "atlas-host-root", standalone: true, imports: [RouterOutlet, AtlasHostStatus, AtlasNavigation, AtlasRouteOutlet, AtlasSlot], template: `<atlas-host-status /><header><strong>Atlas</strong><atlas-slot slotId="header" /></header><atlas-navigation aria-label="Application" /><atlas-route-outlet /><router-outlet hidden />` })
export class AppComponent {}
