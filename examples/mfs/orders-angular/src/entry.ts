import "zone.js";
import { LocationStrategy } from "@angular/common";
import { Component, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, RouterLink, RouterOutlet, type Routes } from "@angular/router";
import { createLocationStrategy, defineApp, injectAtlasSdk, provideAtlasAppContext, provideAtlasSdk } from "@atlas/sdk/angular";

@Component({ selector: "atlas-orders-home", standalone: true, template: `<p>Order list</p>` })
class OrdersHomeComponent {}

@Component({ selector: "atlas-order-details", standalone: true, template: `<p>Order details</p>` })
class OrderDetailsComponent {}

@Component({ selector: "atlas-orders-angular-root", standalone: true, imports: [RouterLink, RouterOutlet], template: `<section><h1>Orders Angular</h1><nav><a routerLink="/">Orders</a> <a routerLink="orders/42">Order 42</a></nav><router-outlet /></section>` })
class AtlasAppRootComponent {
  private readonly atlas = injectAtlasSdk();
  showToast() { this.atlas.toast.open({ title: "Orders Angular is ready" }); }
}

const routes: Routes = [
  { path: "", component: OrdersHomeComponent },
  { path: "orders/:id", component: OrderDetailsComponent }
];

export default defineApp(async ({ container, sdk, context }) => {
  const element = document.createElement("atlas-orders-angular-root");
  const locationStrategy = createLocationStrategy(context);
  container.append(element);
  const app = await bootstrapApplication(AtlasAppRootComponent, { providers: [provideRouter(routes), provideAtlasAppContext(context), provideAtlasSdk(sdk), { provide: LocationStrategy, useValue: locationStrategy }] });
  return { unmount() { app.destroy(); locationStrategy.ngOnDestroy(); element.remove(); } };
});
