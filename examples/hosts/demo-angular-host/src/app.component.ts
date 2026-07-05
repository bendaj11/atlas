import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({ selector: "atlas-router-anchor", standalone: true, template: "" })
export class AtlasRouterAnchorComponent {}

@Component({ selector: "atlas-host-root", standalone: true, imports: [RouterOutlet], template: `<div data-atlas-host-status></div><header><strong>Atlas</strong><div data-atlas-slot="header"></div></header><nav data-atlas-navigation aria-label="Application"></nav><main data-atlas-route-outlet></main><router-outlet hidden />` })
export class AppComponent {}
