# Build A React App

Audience: React feature team with an existing Atlas Host. Finished state: the
App appears in the Host, uses shared Host services through the SDK, and passes
local integration tests. Start with [Get Started](../getting-started.md), then
use this guide.

## 1. Generate

From workspace root:

```sh
atlas g app orders --framework=react --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
```

Copy the Host ID from its `atlas.config.ts`. The generator creates an initial
`/orders` URL for that Host. Keep the generated App ID when you rename the App.

| File                                          | Edit for                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`                             | app UUID, routes, slots, external app dependencies                                                                  |
| `src/App.tsx`                                 | feature root UI                                                                                                     |
| `src/routes.tsx`                              | app-relative inner routes                                                                                           |
| `src/bootstrap.tsx`                           | Atlas lifecycle adapter; rarely change                                                                              |
| `src/exported-widgets/<name>/atlas.config.ts` | exported widget UUID and metadata                                                                                   |
| `vite.config.ts`                              | React plugin, dev server, aliases, and product-specific Vite overrides; keep `createReactAppViteConfig` composition |

## 2. Choose Where The App Appears

The App chooses its own URLs and named page areas. `hostId` must equal the
unique ID from the Host's `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from '@atlas/schema';

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'react',
  routes: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      route: '/orders',
      title: 'Orders',
      nav: { label: 'Orders', visible: true, order: 10 },
    },
  ],
} satisfies AtlasAppConfig;
```

The Host has an HTML element for URL-based Apps and optional named page areas.
This App declares which one it uses. Read [React routing](routing.md) for URL
conflicts, App-only URLs, and navigation rules.

## 3. Build Feature UI

Create normal React components and hooks under `src/app`. Keep product-specific
UI services, including overlays, in the host solution rather than Atlas.

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
