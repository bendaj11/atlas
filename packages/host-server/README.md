# @atlas/host-server

Framework-neutral Atlas HTTP bootstrap server, browser loader, health endpoints,
security headers, deep-link fallback, and recovery UI. Generated hosts compose
this package through editable `server/main.mts`:

```ts
import { runAtlasHostServer } from "@atlas/host-server";

await runAtlasHostServer({ hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506" });
```

Only environment-specific catalog location is required. `PORT` defaults to
`8080`:

```sh
npm install @atlas/host-server

ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
npm run start:server
```

`runAtlasHostServer` also accepts product middleware through
`configureExpress`, custom loading HTML, logging, and explicit runtime values.
It manages listening and graceful shutdown. Lower-level
`createAtlasHostServer` remains available for custom process lifecycle.

Direct `atlas-host-server` CLI remains backward compatible for existing wrappers;
that generic entry cannot embed project identity and therefore requires both
`ATLAS_HOST_ID` and `ATLAS_CATALOG_URL`.

Check `/health/live`, `/health/ready`, and `/atlas.runtime.json`. Product UI is
released independently with `atlas release <host-project>`.

See the [host-server documentation](https://github.com/bendaj11/atlas/blob/main/docs/host-server.md).
