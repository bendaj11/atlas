# Host bootstrap

The bootstrap is the small static website that opens an Atlas host. It contains
HTML, the Atlas browser loader, and a web-server configuration. It does not
contain a selected environment or a selected host release.

This design gives one important result: **build one host image and use that same
image in development, staging, and production**.

## The three URLs

These names are easy to confuse. They have different jobs:

| Name            | Example                            | Meaning                                                                                   |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Registry URL    | `https://assets.example.com/atlas` | Public root where Atlas stores `registry.json`, discovery, manifests, and published files |
| Host URL        | `https://customer.example.com`     | Public page that a person opens in a browser                                              |
| Storage API URL | `https://s3.example.com`           | Private write endpoint used by CI; the browser never uses it                              |

The registry URL should be stable. It is the only deployment address stored in
the bootstrap. It does not select `staging` or `production`.

The host URL may be different for every environment. Atlas records it when the
host is deployed, not when bootstrap is built.

## Build bootstrap

Pass the public registry URL:

```bash
pnpm exec atlas bootstrap customer-host \
  --registry-url https://assets.example.com/atlas
```

You can set the same value through CI instead:

```bash
export ATLAS_REGISTRY_URL=https://assets.example.com/atlas
pnpm exec atlas bootstrap customer-host
```

Generated host projects also contain an `atlas:bootstrap` workspace script or
target. Give it the same variable:

```bash
ATLAS_REGISTRY_URL=https://assets.example.com/atlas \
  pnpm run atlas:bootstrap
```

Output defaults to `<host-directory>/dist/bootstrap`:

```text
atlas.bootstrap.json
atlas.loader.js
es-module-shims.js
index.html
nginx.conf
```

`atlas.bootstrap.json` contains the host ID, stable registry URL, browser
timeouts, optional asset origins, and a build digest. Atlas generates it. Do not
edit it.

There is no `atlas.runtime.json`, runtime template, startup script, embedded
mode, or external mode. A production host does not require
`ATLAS_ENVIRONMENT`.

## How the browser selects an environment

When a page opens, Atlas performs this sequence:

1. The page reads `/atlas.bootstrap.json` from the host.
2. It reads `hosts/<host-id>/discovery.json` from the registry.
3. Discovery compares the current page URL with host URLs registered by
   `atlas deploy`.
4. The most specific matching URL selects the environment manifest.
5. Atlas loads the selected host and apps.

For example:

```json
{
  "schemaVersion": "1",
  "hostId": "27a27fea-5a2c-4ed8-bd31-6e56613932bb",
  "bindings": [
    {
      "baseUrl": "https://staging.customer.example.com",
      "environment": "staging",
      "manifestUrl": "https://assets.example.com/atlas/environments/staging/hosts/27a27fea-5a2c-4ed8-bd31-6e56613932bb/manifest.json"
    },
    {
      "baseUrl": "https://customer.example.com",
      "environment": "production",
      "manifestUrl": "https://assets.example.com/atlas/environments/production/hosts/27a27fea-5a2c-4ed8-bd31-6e56613932bb/manifest.json"
    }
  ]
}
```

Atlas creates and maintains discovery. Consumers do not upload, edit, template,
or generate this file.

Manifest URLs are absolute so the browser never guesses their location. All
environment deployments for one bootstrap are written to its stable registry.
The host websites themselves may run on completely different servers.

## Register the host URL

The first time a host is deployed to an environment, provide its public URL:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.0 \
  --registry-url https://assets.example.com/atlas \
  --host-url https://customer.example.com
```

Atlas remembers that URL. Later deployments may omit it:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.1 \
  --registry-url https://assets.example.com/atlas
```

Provide `--host-url` again only when the public address changes or when adding
another address. Comma-separated aliases are supported:

```bash
--host-url https://customer.example.com,https://www.customer.example.com
```

Rules:

- production URLs must use HTTPS;
- loopback HTTP is accepted for local testing;
- a URL cannot contain credentials, a query, or a fragment;
- Atlas removes trailing slashes;
- the same exact URL cannot belong to two host/environment bindings;
- path bindings are allowed, and the longest matching path wins.

Example path bindings:

```text
https://preview.example.com          -> preview
https://preview.example.com/review   -> review
```

A visit to `/review/orders` selects `review`.

Bootstrap files are still requested from the host origin root, for example
`/atlas.bootstrap.json` and `/atlas.loader.js`. A path binding selects the Atlas
environment; it does not move those files below that path. Configure the host
server or ingress to serve the bootstrap files from the origin root.

## Docker and Nginx

Build bootstrap before building the image. The Dockerfile stays static and has
no Atlas-specific startup logic:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine

COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
```

Build an AMD64 image for Render when building on an ARM Mac:

```bash
docker buildx build \
  --platform linux/amd64 \
  -t your-registry.example/customer-host:1.0.0 \
  --push .
```

No Atlas environment variables are required when the container starts.
`nginxinc/nginx-unprivileged` listens on port `8080`; configure the platform to
send traffic to that port. A platform-provided `PORT` variable is not needed by
this generated Nginx configuration.

## Render

1. Build and push the Linux AMD64 image.
2. Create a Render Web Service from that image.
3. Set the service port to `8080` if Render does not detect it.
4. Wait for the final public URL, such as
   `https://customer-host.onrender.com`.
5. Bind that URL with `atlas deploy --host-url`.
6. Open the URL and run `atlas verify`.

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.0 \
  --registry-url https://assets.example.com/atlas \
  --host-url https://customer-host.onrender.com

pnpm exec atlas verify \
  --host-url https://customer-host.onrender.com
```

If the platform gives the URL only after the first rollout, deploy the image
first and run the Atlas deploy command second. The image itself does not change.

## OpenShift or Kubernetes

Use the same image. The workload needs no Atlas environment variables. Point
the Service at container port `8080`, expose a Route or Ingress, then bind its
public URL:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.0 \
  --host-url https://customer.apps.example.com
```

Changing a ConfigMap, init container, entrypoint, or Nginx template is not part
of the Atlas flow.

## Vercel and other static hosts

Upload the contents of `dist/bootstrap` as the static site. Configure SPA
fallback so routes without a file return `index.html`. Do not add a serverless
function that generates Atlas configuration.

Use the platform's filesystem-first SPA fallback. Keep real files such as
`.json` and `.js` out of the fallback so a missing Atlas file returns an error
instead of HTML. Vercel routing syntax can change; use its current static SPA
rewrite documentation rather than copying an Atlas-specific adapter.

After the site receives its public URL, bind it with the same `atlas deploy
--host-url` command. The discovery mechanism is identical on Docker, OpenShift,
Vercel, Render, S3 website hosting, or any other static host.

## Registry and CDN requirements

The browser must be able to read these registry objects without credentials:

```text
hosts/<host-id>/discovery.json
environments/<environment>/hosts/<host-id>/manifest.json
hosts/<host-id>/<version>/manifest.json
apps/<app-id>/<version>/manifest.json
published payload files
```

Configure:

- HTTPS outside local development;
- `Content-Type: application/json` for JSON;
- CORS allowing each public host origin, or `*` for intentionally public
  registries;
- revalidation or a short cache lifetime for discovery and environment
  manifests;
- long immutable caching for versioned artifact files.

Never expose storage credentials, access keys, or private storage API URLs to
the browser.

## Additional asset origins

If published JavaScript or CSS is served from another origin, allow it when
building bootstrap:

```bash
pnpm exec atlas bootstrap customer-host \
  --registry-url https://assets.example.com/atlas \
  --asset-origins https://cdn.example.com,https://shared-ui.example.com
```

This updates browser security policy. It does not select an environment.

If a host uses external Atlas registries, bind those per environment during the
host deploy:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 1.0.0 \
  --host-url https://customer.example.com \
  --external-registries 'https://shared.example.com/atlas|production'
```

Multiple external registries are comma-separated. Each entry uses
`<registry-url>|<environment>`.

## Custom HTML

Generated hosts include `atlas.bootstrap.html`. Atlas uses it automatically.
Choose another host-relative file with:

```bash
pnpm exec atlas bootstrap customer-host \
  --registry-url https://assets.example.com/atlas \
  --template other.bootstrap.html
```

The HTML must keep:

- an element with `id="atlas-host-root"`;
- the `/atlas.loader.js` module script.

## Updating and rollback

Publishing or deploying a new host-client release does not require rebuilding
the bootstrap image. Atlas changes the environment manifest in the registry.

Rollback selects an older immutable host release:

```bash
pnpm exec atlas deploy customer-host \
  --to production \
  --version 0.9.9
```

Rebuild bootstrap only when its own inputs change, for example:

- Atlas browser loader version;
- stable registry URL;
- custom bootstrap HTML;
- CSP asset origins;
- timeout settings in host configuration.

## Migration from runtime templates

For a host built by an older Atlas version:

1. update Atlas packages;
2. run `atlas bootstrap <host> --registry-url <public-registry-root>`;
3. rebuild or re-upload the static bootstrap;
4. deploy each host environment once with `--host-url`;
5. remove `ATLAS_ENVIRONMENT`, runtime-file scripts, `envsubst`, and
   `nginx.conf.template` from platform configuration;
6. verify the public host URL.

Apps and hosts already published to the registry do not need to be published
again solely for this migration.

## Verify

```bash
pnpm exec atlas verify --host-url https://customer.example.com
```

Verification follows the same bootstrap → discovery → environment manifest →
artifact chain as the browser. It also checks CORS, cache headers, MIME types,
integrity, and deployment convergence.

## Common mistakes

`Atlas bootstrap requires --registry-url`
: Pass the public registry root, not the private S3 API.

`Host ... needs its public URL the first time`
: Add `--host-url` to the first host deploy for that environment.

`Atlas has no deployment binding for this host URL`
: The browser URL does not match any URL registered by host deploy. Run the
host deploy again with the correct public URL.

`Failed to fetch discovery.json`
: Check the registry URL, public read access, CORS, and CDN cache/invalidation.

`invalid platform; linux/amd64 required`
: Rebuild and push with `docker buildx build --platform linux/amd64`.
