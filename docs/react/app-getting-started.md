# Build a React app

Audience: React feature team. Complete [shared getting
started](../getting-started.md) and know target host project plus UUID.

## 1. Generate

```sh
atlas g app orders --framework=react --host=customer-host
```

Generator resolves local host project to UUID and writes initial `/orders`
route. Check these files:

| File | Edit for |
| --- | --- |
| `atlas.config.ts` | app UUID, routes, slots, external provider dependencies |
| `src/app/App.tsx` | feature UI |
| `src/app/routes.tsx` | app-relative inner routes |
| `src/entry.tsx` | Atlas lifecycle adapter; rarely change |
| `vite.config.ts` | generated federation wiring; preserve Atlas sections |

## 2. Build feature UI

Use SDK from React tree:

```tsx
import { useAtlasSdk } from "@atlas/sdk/react";

export function OrdersToolbar() {
  const atlas = useAtlasSdk();
  return <button onClick={() => atlas.navigation.navigate("/billing")}>Billing</button>;
}
```

Use React Router for screens within `/orders`; use Atlas navigation for
host/cross-app paths. See [React routing](routing.md) and [React SDK](sdk.md).

## 3. Run inside host

From workspace root, use two terminals:

```sh
# Terminal 1
atlas dev customer-host

# Terminal 2
atlas dev orders --host-url=http://127.0.0.1:4300/orders
```

Atlas infers host UUID when app declares one host. For several hosts, pass UUID
with `--host`, not folder name. Checkpoint: Host Preview on port 4300 renders
Orders at `/orders`; port 4200 remains lower-level framework asset server.

## 4. Release

Protected CI uses canonical command:

```sh
ATLAS_VERSION=1.4.0 \
ATLAS_BUILD_ID="$CI_PIPELINE_ID" \
ATLAS_REGISTRY_BASE_URL=https://cdn.example.com/atlas \
atlas release orders
```

For credential-separated jobs, use `atlas build orders`, transfer
`dist/atlas-publication/` plus `dist/atlas-publication.json`, then run
`atlas publish --plan=orders/dist/atlas-publication.json`. See
[Production deployment](../production-deployment.md).

## 5. Verify and continue

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Checkpoint: `/orders` loads, nested refresh works, SDK calls work, and report has
no failures. Continue with [Assets](assets-and-styles.md), [widgets](../exported-widgets.md),
and [Consumer testing](../consumer-testing.md).
