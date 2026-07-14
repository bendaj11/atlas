# Production Deployment

Atlas has two independent delivery paths:

1. infrequent static bootstrap deployment to product domain;
2. routine host/app artifact publication to registry/CDN.

## Provision Environment Once

Build bootstrap:

```sh
atlas build-bootstrap customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Build Nginx image:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine
COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

Push image, deploy container, then route `https://product.com` to it through
DNS/ingress/TLS. Deploy bootstrap again only when loader, runtime config,
template, or HTTP policy changes.

## Release Host Or App

```sh
atlas build customer-host --registry-base-url=https://cdn.example.com/atlas
atlas publish --plan customer-host/dist/atlas-publication.json \
  --runtime-url=https://product.com/atlas.runtime.json

atlas build orders --registry-base-url=https://cdn.example.com/atlas
atlas publish --plan orders/dist/atlas-publication.json \
  --runtime-url=https://product.com/atlas.runtime.json
```

Publication order is immutable artifacts first, mutable indexes next, affected
catalogs last. Routine release does not rebuild Nginx image. `atlas release`
combines build and publish when CI uses configured publication adapter.

## CI/CD Jobs

Bootstrap job:

1. build and test Atlas packages;
2. run `atlas build-bootstrap`;
3. build and scan Nginx image;
4. push image and deploy;
5. verify `/health/live`, `/atlas.runtime.json`, deep link, and missing-asset 404.

Artifact release job:

1. test and build one host/app;
2. create publication plan;
3. upload to registry/CDN;
4. activate catalog last;
5. run `atlas verify` against each deployed host.

Rollback changes catalog selection, not container image:

```sh
atlas rollback <artifact-id> --version=1.3.2 \
  --registry-base-url=https://cdn.example.com/atlas \
  --runtime-url=https://product.com/atlas.runtime.json
```

## Required Delivery Policy

- `index.html` and `atlas.runtime.json`: `no-cache`/revalidate.
- Versioned artifact paths: long-lived `immutable` caching.
- Extensionless routes: rewrite to `/index.html`.
- Missing asset paths: return `404`, never HTML.
- Runtime/catalog/artifacts: browser-accessible HTTPS origins allowed by CSP and CORS.
- Publication credentials: CI only; never place them in bootstrap or browser config.

See [Static bootstrap](bootstrap.md), [Registry](registry.md), and
[Production readiness](production-readiness.md).
