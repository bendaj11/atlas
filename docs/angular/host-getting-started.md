# Build An Angular Host

Audience: Angular team owning product shell and host services. Finished state:
host shell runs locally, exposes required mount anchors, and provides app
services through SDK. Complete [Zero to production](../getting-started.md) once
before using this task guide.

## 1. Generate

From workspace root:

```sh
atlas g host customer-host --framework=angular
```

Keep generated UUID in `atlas.config.ts` across folder, package, and display-name
changes.

| File | Edit for |
| --- | --- |
| `src/app/app.component.ts` | product layout and Atlas anchors |
| `src/bootstrap.ts` | router, auth, HTTP, SDK extensions, monitoring |
| `src/host.ts` | Atlas lifecycle adapter; rarely change |
| `federation.config.js` | generated federation wiring; preserve Atlas sections |
| `server/main.mts` | auth middleware, BFF routes, errors, observability |

## 2. Build Product Shell

Keep anchors required by selected apps:

- `data-atlas-host-status` for startup and failure state;
- `data-atlas-navigation` for host navigation;
- `data-atlas-route-outlet` for routed apps;
- named `data-atlas-slot` elements for slot-mounted apps.

Add product services in `startHost` options inside `src/bootstrap.ts`. Apps
receive those services through SDK and must not import host source. See [Angular
SDK](sdk.md) and [Angular routing](routing.md).

Host client does not fetch or choose catalog. Atlas loader passes selected
catalog into `mount` request.

## 3. Extend Server When Needed

Generated `server/main.mts` is separate Node.js composition root:

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
`4200` is lower-level Angular asset server.

Checkpoint: shell renders, required anchors exist, `/health/ready` returns
`ready`, and Columbus identifies local host client.

Production server deployment and host-client publication are independent.
Continue with [Production deployment](../production-deployment.md).
