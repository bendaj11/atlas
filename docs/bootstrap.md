# Static Bootstrap

Atlas product domain serves four generated static files:

```text
dist/bootstrap/
  index.html
  atlas.loader.js
  atlas.runtime.json
  nginx.conf
```

`index.html` provides `#atlas-host-root` and loads `/atlas.loader.js`. Loader
reads runtime config and catalog, applies approved Columbus overrides, loads
selected host artifact, then mounts it. Bootstrap contains no product UI and
needs no Node.js application server.

## Build

```sh
atlas build-bootstrap customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Default output: `<host>/dist/bootstrap`. Generate it during environment or
bootstrap deployment. Normal host/app releases only publish versioned artifacts
and catalog changes; they do not rebuild bootstrap.

Useful options:

| Option | Purpose |
| --- | --- |
| `--out <path>` | Change output directory |
| `--template <path>` | Use custom HTML relative to host project |
| `--title <text>` | Set default template title |
| `--loading-html <html>` | Set default loading markup |
| `--asset-origins <urls>` | Add approved artifact origins and CSP sources |
| `--external-registry-urls <urls>` | Add approved external registries |

Custom HTML must retain an element with `id="atlas-host-root"` and a script
loading `/atlas.loader.js`. Atlas validates both hooks.

Overrides default off in generated production runtime. Set
`allowOverrides: true` in host `atlas.config.ts` when Columbus substitution is
part of environment policy; local `atlas dev` always enables it.

## Nginx Container

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine

COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
```

Route DNS/ingress for `https://product.com` to this container. Generated Nginx
config supplies:

- SPA fallback to `/index.html` for extensionless browser routes;
- real `404` responses for missing `.js`, `.css`, and other assets;
- `no-cache` for mutable HTML/runtime config;
- CSP, `nosniff`, referrer, and frame restrictions;
- `/health/live` for container health checks.

Equivalent CDN/static hosting is valid when it implements same fallback,
caching, headers, and asset-404 behavior.

## Local Development

`atlas dev customer-host` starts framework server, Atlas control service, and
ephemeral static bootstrap at `http://localhost:4200` by default. These are local
tools, not production application-server requirements. Use `--port` to change
browser-facing port or `--host-url` to use an already running page.

## When Backend Is Still Needed

Deploy separate backend/BFF only for server-side sessions, APIs, SSR,
personalized HTML, or per-request configuration. It is product infrastructure,
not default Atlas bootstrap. Route `/api/*` to it through ingress while static
bootstrap continues serving browser routes.
