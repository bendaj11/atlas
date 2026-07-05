import "zone.js";
import { LocationStrategy } from "@angular/common";
import { Component, InjectionToken, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, RouterLink, RouterOutlet, type Routes } from "@angular/router";
import { createLocationStrategy, defineMicrofrontend, injectAtlasSdk, provideAtlasSdk } from "@atlas/sdk/angular";
import type { AtlasMfContext } from "@atlas/sdk/lifecycle";

export const ATLAS_MF_CONTEXT = new InjectionToken<AtlasMfContext>("ATLAS_MF_CONTEXT");

@Component({ selector: "atlas-orders-home", standalone: true, template: `<p>Order list</p>` })
class OrdersHomeComponent {}

@Component({ selector: "atlas-order-details", standalone: true, template: `<p>Order details</p>` })
class OrderDetailsComponent {}

@Component({ selector: "atlas-orders-angular-root", standalone: true, imports: [RouterLink, RouterOutlet], template: `<section><h1>Orders Angular</h1><nav><a routerLink="/">Orders</a> <a routerLink="orders/42">Order 42</a></nav><router-outlet /></section>` })
class AtlasMfRootComponent {
  private readonly atlas = injectAtlasSdk();
  openToast() { this.atlas.toast.open({ title: "Orders Angular is ready" }); }
}

const routes: Routes = [
  { path: "", component: OrdersHomeComponent },
  { path: "orders/:id", component: OrderDetailsComponent }
];

export default defineMicrofrontend(async ({ container, sdk, context }) => {
  const element = document.createElement("atlas-orders-angular-root");
  const locationStrategy = createLocationStrategy(context);
  container.append(element);
  const app = await bootstrapApplication(AtlasMfRootComponent, { providers: [provideRouter(routes), provideAtlasSdk(sdk), { provide: LocationStrategy, useValue: locationStrategy }, { provide: ATLAS_MF_CONTEXT, useValue: context }] });
  context.ready();
  return { unmount() { app.destroy(); locationStrategy.ngOnDestroy(); element.remove(); } };
});
