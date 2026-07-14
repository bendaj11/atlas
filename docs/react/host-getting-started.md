# Build A React Host

Audience: React team owning product shell and host services. Finished state: host
shell runs locally, exposes required mount anchors, and provides app services
through SDK. Complete [Zero to production](../getting-started.md) once before
using this task guide.

## 1. Generate

From workspace root:

```sh
atlas g host customer-host --framework=react
```

Keep generated UUID in `atlas.config.ts` across folder, package, and display-name
changes.

| File | Edit for |
| --- | --- |
| `src/app/HostLayout.tsx` | product layout and Atlas anchors |
| `src/CustomerHostAtlasProvider.tsx` | router, auth, HTTP, SDK services, monitoring |
| `src/host.tsx` | Atlas lifecycle adapter; rarely change |
| `vite.config.ts` | generated federation wiring; preserve Atlas sections |
| `customer-host-server/main.mts` | auth middleware, BFF routes, errors, observability |

Provider filename derives from project name: `customer-host` becomes
`CustomerHostAtlasProvider.tsx`.

## 2. Build Product Shell

Keep anchors required by selected apps:

- `data-atlas-host-status` for startup and failure state;
- `data-atlas-navigation` for host navigation;
- `data-atlas-route-outlet` for routed apps;
- named `data-atlas-slot` elements for slot-mounted apps.

Configure product services through `AtlasHostProvider` options. Apps receive
those services through SDK and must not import host source. See [React SDK](sdk.md)
and [React routing](routing.md).

Host client does not fetch or choose catalog. Atlas loader passes selected
catalog into `mount` request.

## 3. Extend Server When Needed

Generated `customer-host-server/main.mts` is separate Node.js project and composition root:

```ts
import { runAtlasHostServer } from "@atlas/host-server";

await runAtlasHostServer({
  hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506",
  configureExpress(app) {
    app.get("/api/session", (_request, response) => response.json({ authenticated: true }));
  }
});
```

Keep real secrets server-side. Do not add product UI or publication credentials
to server. See [Host server](../host-server.md).

## 4. Run And Check

```sh
atlas dev customer-host
```

Open host preview URL printed by CLI, normally `http://127.0.0.1:4300`. Port
`4200` is lower-level Vite asset server.

Checkpoint: shell renders, required anchors exist, `/health/ready` returns
`ready`, and Columbus identifies local host client.

Production server deployment and host-client publication are independent.
Continue with [Production deployment](../production-deployment.md).
