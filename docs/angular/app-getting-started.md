# Build An Angular App

Audience: Angular feature team with an existing Atlas Host. Finished state: the
App appears in the Host, uses shared Host services through the SDK, and passes
local integration tests. Start with [Get Started](../getting-started.md), then
use this guide.

## 1. Generate

From workspace root:

```sh
atlas g app orders --framework=angular --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
```

Copy the Host ID from its `atlas.config.ts`. The generator creates an initial
`/orders` URL for that Host. Keep the generated App ID when you rename the App.

| File                                          | Edit for                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `atlas.config.ts`                             | app UUID, routes, slots, external app dependencies                         |
| `src/app/app.component.ts`                    | feature root UI                                                            |
| `src/app/app.config.ts`                       | Angular and Atlas providers                                                |
| `src/app/app.routes.ts`                       | app-relative inner routes                                                  |
| `src/main.ts`                                 | Angular entry and Atlas lifecycle adapter; rarely change                   |
| `src/exported-widgets/<name>/atlas.config.ts` | exported widget UUID and metadata                                          |
| `federation.config.js`                        | Native Federation options; Atlas keeps required exposure and sharing rules |

## 2. Choose Where The App Appears

The App chooses its own URLs and named page areas. `hostId` must equal the
unique ID from the Host's `atlas.config.ts`:

```ts
import type { AtlasAppConfig } from '@atlas/schema';

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'angular',
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
This App declares which one it uses. Read [Angular routing](routing.md) for URL
conflicts, App-only URLs, and navigation rules.

## 3. Build Feature UI

Create normal Angular components and services under `src/app`. Keep
product-specific UI services, including overlays, in the host solution rather
than Atlas.

Use Angular Router within `/orders`; use Atlas navigation for host or cross-app
destinations. Do not import host source. See [Angular SDK](sdk.md) and [Angular
assets and styles](assets-and-styles.md).

## 4. Run Inside Host

In `package.json`, add the host page where Orders runs:

```json
{
  "atlas": {
    "previews": ["http://localhost:4200/orders"]
  }
}
```

Open two terminals at workspace root:

```sh
# Terminal 1
atlas dev customer-host
```

```sh
# Terminal 2
atlas dev orders
```

Checkpoint: host preview renders Orders at `/orders`, nested refresh works, and
Columbus can reset Orders without replacing host client. For multi-host apps,
list each host page in `atlas.previews`; Atlas prompts for one at startup.

## 5. Test And Continue

Test feature states plus mount/unmount and required SDK contracts. Run app inside
real host before release. See [Consumer testing](../consumer-testing.md).

Production build, publication, verification, and rollback are
framework-neutral. Continue with [Angular production deployment](production-deployment.md),
which links each framework build step to canonical publication and rollback.
