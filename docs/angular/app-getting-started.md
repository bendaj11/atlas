# Build An Angular App

Audience: Angular feature team with an existing Atlas host. Finished state: app
mounts inside host, uses host services through SDK, and passes local contract
checks. Complete [Zero to production](../getting-started.md) once before using
this task guide.

## 1. Generate

From workspace root:

```sh
atlas g app orders --framework=angular --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
```

Copy host UUID from host project's `atlas.config.ts`. Generator creates initial
`/orders` route for that exact host ID. Keep generated app UUID stable across
renames.

| File | Edit for |
| --- | --- |
| `atlas.config.ts` | app UUID, routes, slots, external app dependencies |
| `src/app/app.component.ts` | feature root UI |
| `src/app/routes.ts` | app-relative inner routes |
| `src/entry.ts` | Atlas lifecycle adapter; rarely change |
| `src/exported-widgets/<name>/atlas.config.ts` | exported widget UUID and metadata |
| `federation.config.js` | generated federation wiring; preserve Atlas sections |

## 2. Declare Placement

App owns its placement declarations. Route `hostId` must equal stable UUID from
host `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from "@atlas/schema";

export default {
  type: "app",
  id: "2bea9c13-4899-4f93-9211-cd8c55e9c529",
  name: "Orders",
  framework: "angular",
  routes: [{
    hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
    basePath: "/orders",
    title: "Orders",
    nav: { label: "Orders", visible: true, order: 10 }
  }]
} satisfies AtlasAppConfig;
```

Host provides route outlet and named slot anchors; app claims routes and slots.
Use [Angular routing](routing.md) for conflict, inner-route, and navigation rules.

## 3. Build Feature UI

Create normal Angular components and services under `src/app`. Obtain host
services through dependency injection:

```ts
import { Component } from "@angular/core";
import { injectAtlasSdk } from "@atlas/sdk/angular";

@Component({
  selector: "orders-toolbar",
  standalone: true,
  template: `<button type="button" (click)="save()">Save order</button>`
})
export class OrdersToolbarComponent {
  private readonly atlas = injectAtlasSdk();

  save(): void {
    this.atlas.toast.open({ title: "Order saved", state: "success" });
  }
}
```

Use Angular Router within `/orders`; use Atlas navigation for host or cross-app
destinations. Do not import host source. See [Angular SDK](sdk.md) and [Angular
assets and styles](assets-and-styles.md).

## 4. Run Inside Host

Open two terminals at workspace root:

```sh
# Terminal 1
atlas dev customer-host
```

```sh
# Terminal 2
atlas dev orders --host-url=http://localhost:4200/orders
```

Checkpoint: host preview renders Orders at `/orders`, nested refresh works, and
Columbus can reset Orders without replacing host client. For multi-host apps,
pass stable UUID with `--host`.

## 5. Test And Continue

Test feature states plus mount/unmount and required SDK contracts. Run app inside
real host before release. See [Consumer testing](../consumer-testing.md).

Production build, publication, verification, and rollback are
framework-neutral. Continue with [Angular production deployment](production-deployment.md),
which links each framework build step to canonical publication and rollback.
