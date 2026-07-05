import "zone.js";
import { Component, InjectionToken, inject } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { defineExportedComponent } from "@atlas/sdk/angular";

export interface OrderStatusProps {
  status: "pending" | "paid" | "cancelled";
}

const ORDER_STATUS_PROPS = new InjectionToken<OrderStatusProps>("ORDER_STATUS_PROPS");

@Component({
  selector: "atlas-order-status",
  standalone: true,
  template: `<strong>Status: {{ props.status }}</strong>`
})
class OrderStatusComponent {
  readonly props = inject(ORDER_STATUS_PROPS);
}

export default defineExportedComponent<OrderStatusProps>(async ({ container, props }) => {
  const element = document.createElement("atlas-order-status");
  container.append(element);
  const app = await bootstrapApplication(OrderStatusComponent, {
    providers: [{ provide: ORDER_STATUS_PROPS, useValue: props }]
  });
  return {
    unmount() {
      app.destroy();
      element.remove();
    }
  };
});
