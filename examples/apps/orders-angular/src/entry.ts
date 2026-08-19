import "zone.js";
import { LocationStrategy } from "@angular/common";
import { Component } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { createComponent } from "@angular/core";
import { provideRouter, RouterLink, RouterOutlet, type Routes } from "@angular/router";
import { createLocationStrategy, defineApp, provideAtlasAppContext, provideAtlasSdk } from "@atlas/sdk/angular";

@Component({ selector: "atlas-orders-home", standalone: true, template: `<p>Order list</p>` })
class OrdersHomeComponent {}

@Component({ selector: "atlas-order-details", standalone: true, template: `<p>Order details</p>` })
class OrderDetailsComponent {}

@Component({ selector: "atlas-orders-angular-root", standalone: true, imports: [RouterLink, RouterOutlet], template: `<section><h1>Orders Angular</h1><nav><a routerLink="/">Orders</a> <a routerLink="orders/42">Order 42</a></nav><router-outlet /></section>` })
class AtlasAppRootComponent {}

const routes: Routes = [
  { path: "", component: OrdersHomeComponent },
  { path: "orders/:id", component: OrderDetailsComponent }
];

export default defineApp(async ({ container, sdk, context }) => {
  const element = document.createElement("atlas-orders-angular-root");
  const locationStrategy = createLocationStrategy(context);
  container.append(element);
  const app = await createApplication({ providers: [provideRouter(routes), provideAtlasAppContext(context), provideAtlasSdk(sdk), { provide: LocationStrategy, useValue: locationStrategy }] });
  const component = createComponent(AtlasAppRootComponent, {
    environmentInjector: app.injector,
    hostElement: element,
  });
  app.attachView(component.hostView);
  component.changeDetectorRef.detectChanges();
  return { unmount() { app.detachView(component.hostView); component.destroy(); app.destroy(); locationStrategy.ngOnDestroy(); element.remove(); } };
});
