# Build A React App

Audience: React feature team with an existing Atlas host. Finished state: app
mounts inside host, uses host services through SDK, and passes local contract
checks. Complete [Zero to production](../getting-started.md) once before using
this task guide.

## 1. Generate

From workspace root:

```sh
atlas g app orders --framework=react --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
```

Copy host UUID from host project's `atlas.config.ts`. Generator creates initial
`/orders` route for that exact host ID. Keep generated app UUID stable across
renames.

| File | Edit for |
| --- | --- |
| `atlas.config.ts` | app UUID, routes, slots, external app dependencies |
| `src/app/App.tsx` | feature root UI |
| `src/app/routes.tsx` | app-relative inner routes |
| `src/entry.tsx` | Atlas lifecycle adapter; rarely change |
| `src/exported-widgets/<name>/atlas.widget.ts` | exported widget UUID and metadata |
| `vite.config.ts` | generated federation wiring; preserve Atlas sections |

## 2. Declare Placement

App owns its placement declarations. Route `hostId` must equal stable UUID from
host `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from "@atlas/schema";

export default {
  type: "app",
  id: "2bea9c13-4899-4f93-9211-cd8c55e9c529",
  name: "Orders",
  framework: "react",
  routes: [{
    hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
    basePath: "/orders",
    title: "Orders",
    nav: { label: "Orders", visible: true, order: 10 }
  }]
} satisfies AtlasAppConfig;
```

Host provides route outlet and named slot anchors; app claims routes and slots.
Use [React routing](routing.md) for conflict, inner-route, and navigation rules.

## 3. Build Feature UI

Create normal React components and hooks under `src/app`. Obtain host services
from Atlas context:

```tsx
import { useAtlasSdk } from "@atlas/sdk/react";

export function OrdersToolbar() {
  const atlas = useAtlasSdk();
  return (
    <button onClick={() => atlas.toast.open({ title: "Order saved", state: "success" })}>
      Save order
    </button>
  );
}
```

Use React Router within `/orders`; use Atlas navigation for host or cross-app
destinations. Do not import host source. See [React SDK](sdk.md) and [React
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
framework-neutral. Continue with [React production deployment](production-deployment.md),
which links each framework build step to canonical publication and rollback.
