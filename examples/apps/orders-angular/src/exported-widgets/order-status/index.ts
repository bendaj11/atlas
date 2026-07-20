import { Component, input } from "@angular/core";

@Component({
  selector: "atlas-order-status",
  standalone: true,
  template: `<strong>Status: {{ status() }}</strong>`
})
export default class OrderStatusComponent {
  readonly status = input.required<"pending" | "paid" | "cancelled">();
}
