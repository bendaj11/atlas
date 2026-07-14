# @atlas/host-server

Express middleware for an Atlas host. Product owns the Express application,
middleware, routes, errors, listening, and shutdown. Atlas supplies bootstrap
HTML, browser loader, runtime configuration, health defaults, security headers,
deep-link fallback, and recovery UI.

```ts
import express from "express";
import { atlas } from "@atlas/host-server";
import { productApi } from "./api.js";

const app = express();
const port = Number(process.env.PORT ?? 8080);

app.use("/api", productApi);
app.use(atlas({ hostId: "0a17281f-287b-4d89-a8ca-0ab0e577c506" }));

app.listen(port);
```

Mount Atlas last. Its browser fallback handles unmatched `GET` requests without
asset extensions.

Only environment-specific catalog location is required:

```sh
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
npm run start
```

Optional environment includes `ATLAS_ASSET_ORIGINS`,
`ATLAS_ALLOW_OVERRIDES`, `ATLAS_RESOURCE_TIMEOUT_MS`,
`ATLAS_RESOURCE_RETRY_COUNT`, and `ATLAS_EXTERNAL_REGISTRY_URLS`.

Check `/health/live`, `/health/ready`, and `/atlas.runtime.json`. Versioned host
client and apps are selected through catalog and released independently from
server.

`runAtlasHostServer` and `createAtlasHostServer` remain compatibility helpers for
existing consumers. New projects should mount `atlas()` in their own Express
application.

See [host-server documentation](https://github.com/bendaj11/atlas/blob/main/docs/host-server.md).
