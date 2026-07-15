# Zero To Production

This path creates one host, one app, static bootstrap, and normal release flow.

## 1. Install And Generate

```sh
npm install --save-dev --save-exact @atlas/cli
npx atlas g host customer-host --framework=react
npx atlas g app orders --framework=react --host-id=<id-from-host-atlas.config.ts>
```

Use `--framework=angular` when needed. Host generation creates only framework
host project. No sibling server project exists.

## 2. Develop Locally

```sh
# Terminal 1
npx atlas dev customer-host

# Terminal 2
npx atlas dev orders --host-url=http://localhost:4200/orders
```

First command starts host framework server, Atlas control service, and ephemeral
static bootstrap. Columbus can override host/app selections. Second command
registers local app override and opens host route.

Checkpoint:

- `http://localhost:4200/atlas.runtime.json` returns host runtime config;
- deep routes load same shell;
- host and app render together;
- stopping app removes local override session.

## 3. Test And Build Artifacts

```sh
npm test
npx atlas build customer-host --registry-base-url=https://cdn.example.com/atlas
npx atlas build orders --registry-base-url=https://cdn.example.com/atlas
```

Each build creates immutable framework files, manifest, registry mutations, and
publication plan. Publishing only these files is not enough for brand-new
environment; product domain still needs static bootstrap.

## 4. Build Bootstrap

```sh
npx atlas build-bootstrap customer-host \
  --registry-base-url=https://cdn.example.com/atlas
```

Output:

```text
customer-host/dist/bootstrap/
  index.html
  atlas.loader.js
  atlas.runtime.json
  nginx.conf
```

Optional customization:

```sh
npx atlas build-bootstrap customer-host \
  --registry-base-url=https://cdn.example.com/atlas \
  --template=atlas.bootstrap.html
```

Template must retain `#atlas-host-root` and `/atlas.loader.js` script.

## 5. Deploy Product Domain

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine
COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

Build image from host directory, push to image registry, deploy container, then
route `https://product.com` to it. This matches normal frontend container flow;
difference is image contains Atlas bootstrap rather than full host framework
build. Selected host is downloaded from registry/CDN at runtime.

## 6. Publish Host And App

Configure publication adapter, then publish plans:

```sh
npx atlas generate publish-config
npx atlas publish --plan customer-host/dist/atlas-publication.json \
  --runtime-url=https://product.com/atlas.runtime.json
npx atlas publish --plan orders/dist/atlas-publication.json \
  --runtime-url=https://product.com/atlas.runtime.json
```

Host/app releases normally do not rebuild or redeploy Nginx container. Catalog
activation makes new version visible after browser refresh.

## 7. Verify And Roll Back

```sh
npx atlas verify \
  --runtime-url=https://product.com/atlas.runtime.json \
  --host-origin=https://product.com

npx atlas rollback <artifact-id> --version=<previous-version> \
  --registry-base-url=https://cdn.example.com/atlas \
  --runtime-url=https://product.com/atlas.runtime.json
```

Rollback changes catalog pointer. Bootstrap container stays unchanged.

## Ownership

| Piece | Owner | Release frequency |
| --- | --- | --- |
| Static bootstrap template/config | Atlas/platform team | Loader/runtime/HTTP policy changes |
| Nginx image, domain, TLS, ingress | Platform delivery | Environment/bootstrap changes |
| Versioned host client | Host team | Product-shell changes |
| Versioned apps | App teams | Feature changes |
| Registry/catalog | Publication pipeline | Every activation/rollback |

Backend/BFF remains optional for APIs, server-side sessions, SSR, personalized
HTML, or per-request config. Route it separately; Atlas does not generate it.
