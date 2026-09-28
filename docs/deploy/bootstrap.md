---
title: Host bootstrap
description: What the Atlas bootstrap contains, how it loads a host, and the headers, CSP, caching, and CORS rules your platform must provide.
---

# Host bootstrap

The bootstrap is the small static page that starts an Atlas host in the browser. This page explains what `npx atlas bootstrap` generates, what `atlas.runtime.json` must contain, and the host platform contract: the response headers, Content Security Policy (CSP), caching, and CORS rules your web server and registry must follow. It is for platform engineers who serve the host.

## What the bootstrap contains

`npx atlas bootstrap <host>` writes three files to `<host>/dist/bootstrap`:

```text
index.html
atlas.loader.js
es-module-shims.js
```

- `index.html` contains the `atlas-host-root` element, a loading placeholder, and a module script that loads `/atlas.loader.js?v=<hash>`. The hash changes when the loader changes.
- `atlas.loader.js` is the Atlas [loader](../introduction/glossary.md). It reads the runtime config, resolves the deployed host and apps, verifies them, and mounts the host.
- `es-module-shims.js` is the ES module shim the loader runs in shim mode to load Native Federation modules.

The bootstrap contains no environment name and no registry URL. You build it once and serve the same files in every environment. Atlas does not generate a web server configuration; you write it using the [host platform contract](#host-platform-contract) below.

### Command options

| Option                  | Effect                                                                     |
| ----------------------- | -------------------------------------------------------------------------- |
| `--out <path>`          | Writes to another directory. The default is `<host>/dist/bootstrap`.       |
| `--template <path>`     | Uses another HTML template instead of the host's `atlas.bootstrap.html`.   |
| `--title <text>`        | Sets the document title when no template file exists.                      |
| `--loading-html <html>` | Replaces the loading placeholder when no template file exists.             |
| `--skip-compile`        | Uses the already compiled `atlas.config.ts` instead of compiling it again. |

When the host project contains an `atlas.bootstrap.html` file, Atlas uses it as the template. A template must keep an element with `id="atlas-host-root"` and a script element that loads `/atlas.loader.js`; otherwise the command fails with `BOOTSTRAP_TEMPLATE_INVALID`.

## Runtime config

Your platform, not Atlas, writes `/atlas.runtime.json` on the host's origin. It tells the loader which host to start, which environment to show, and where the registries are.

```json
{
  "schemaVersion": "v1",
  "hostId": "27a27fea-5a2c-4ed8-bd31-6e56613932bb",
  "environment": "production",
  "artifactRegistryUrl": "https://assets.example.com/atlas",
  "environmentRegistryUrl": "https://deployments.example.com/atlas"
}
```

| Field                    | Required | Meaning                                                                                  |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| `schemaVersion`          | Yes      | Always `"v1"`.                                                                           |
| `hostId`                 | Yes      | The `id` from the host's `atlas.config.ts`.                                              |
| `environment`            | Yes      | The environment name you pass to `npx atlas deploy --to`.                                |
| `artifactRegistryUrl`    | Yes      | Root of the [artifact registry](../reference/registry.md) that holds published releases. |
| `environmentRegistryUrl` | No       | Root that holds `environments/**`. Defaults to `artifactRegistryUrl`.                    |
| `hostVersion`            | No       | Informational host version.                                                              |

Registry URLs must use HTTPS (plain HTTP is allowed only for loopback addresses) and must not contain credentials, a query, a hash, or a trailing slash. A relative reference such as `/atlas` resolves against `/atlas.runtime.json`, which is useful behind a same-origin reverse proxy.

Any other field is rejected. The fields `resourcesTimeoutMs`, `resourcesRetryCount`, and `developmentSessionUrl` are accepted only when `environment` is `"development"`. Older fields such as `assetOrigins`, `manifestUrl`, and `registryUrl` are always rejected.

The file is public. Never put secrets, tokens, or private storage URLs in it.

## How the loader starts a host

1. The browser loads `index.html` and `atlas.loader.js` from the host origin. The loader starts loading `es-module-shims.js` in parallel with the next steps.
2. The loader reads `/atlas.runtime.json`.
3. The loader reads the active host manifest from `<environmentRegistryUrl>/environments/<environment>/hosts/<hostId>/manifest.json`. If the [Columbus](../guides/columbus.md) extension is installed, the loader asks it for local overrides at the same time.
4. The loader downloads the referenced artifact manifests from `artifactRegistryUrl` and checks each one against the size and SHA-256 digest recorded in the deployment. When the artifact registry uses its own origin, the loader opens a connection to it early.
5. The loader applies any overrides, validates the resulting host catalog, adds the host stylesheets, verifies the host remote entry's integrity, and imports the host.
6. The host runtime mounts slot apps and the current route app in parallel.

The bootstrap placeholder inside `atlas-host-root` stays until the host renders. After that, each app and widget shows its own loading state until it has mounted.

The loader always revalidates `atlas.runtime.json` and the host deployment manifest. It lets the browser HTTP cache serve content it can verify itself: artifact manifests (checked against their digest) and host remote entries that carry an integrity value. If cached bytes fail verification, the loader fetches them again from the network before it reports an error.

### Startup failures

If the loader cannot start the host, it replaces the page with a "Product failed to start" panel that shows the error, suggested actions, and a **Clear overrides and reload** button, and logs the failure to the browser console. The error code is one of `DEPLOYMENT_INVALID`, `CATALOG_INVALID`, `HOST_MANIFEST_INVALID`, `ARTIFACT_URL_REJECTED`, `ARTIFACT_VERIFICATION_FAILED`, `OVERRIDE_INVALID`, `RESOURCE_UNAVAILABLE`, `HOST_REMOTE_INVALID`, `MODULE_LOADER_UNAVAILABLE`, or `HOST_MOUNT_FAILED`. Errors without a specific code use `ATLAS_BOOTSTRAP_FAILED`.

## Host platform contract

Your platform owns the web server, routing, response headers, and CDN. Atlas cannot configure them, and `npx atlas verify` checks only some of them. This section lists what the loader and runtime need.

### Serve the host origin

- Serve `index.html`, `atlas.loader.js`, `es-module-shims.js`, and `atlas.runtime.json` from the same origin over HTTPS.
- Return `index.html` for browser navigation routes such as `/orders/42` (SPA fallback).
- Never rewrite a missing `.js`, `.json`, or `.css` file to `index.html`. Return `404` so that the loader reports a clear error instead of trying to parse HTML.
- Serve JavaScript as `text/javascript`, JSON as `application/json`, and CSS as `text/css`.

### Set cache headers

| Files                                                 | Cache-Control                          | Why                                                                                        |
| ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `index.html`, `atlas.loader.js`, `es-module-shims.js` | `no-cache`                             | The files are small, and `es-module-shims.js` has no version in its URL.                   |
| `atlas.runtime.json`                                  | `no-cache`                             | The platform can change it at any time.                                                    |
| `registry.json`, `environments/**`                    | `no-cache, max-age=0, must-revalidate` | Deploys replace these files in place. `atlas verify` fails if they are marked `immutable`. |
| `apps/<id>/<version>/**`, `hosts/<id>/<version>/**`   | `public, max-age=31536000, immutable`  | Release paths never change. `atlas verify` warns if they are not cached as immutable.      |

Atlas stores these `Cache-Control` values as object metadata when it uploads to the registry. Make sure your CDN passes them through, and invalidate `registry.json` and `environments/**` after a deploy if your CDN caches them.

### Allow cross-origin reads from the registries

When a registry is on a different origin from the host, it must answer `GET` and `HEAD` requests for every file (JSON, JavaScript, CSS, fonts, images) with `Access-Control-Allow-Origin` set to the host origin or `*`. The loader sends no credentials, so do not set `Access-Control-Allow-Credentials`. `npx atlas verify` checks this header on the files it fetches.

### Write a Content Security Policy

Start from this reference policy and replace the example origins. Send it as a response header on `index.html`.

```text
default-src 'self';
script-src 'self' blob: https://assets.example.com;
style-src 'self' 'unsafe-inline' https://assets.example.com;
connect-src 'self' https://assets.example.com https://deployments.example.com https://api.example.com;
img-src 'self' data: https://assets.example.com;
font-src 'self' https://assets.example.com;
object-src 'none';
base-uri 'self';
frame-ancestors 'self'
```

Each source is there for a reason:

- **`script-src 'self'`** loads `atlas.loader.js` and `es-module-shims.js`.
- **`script-src` artifact registry origin.** Published releases live in the artifact registry. The loader rejects a published host outside the `artifactRegistryUrl` origin, and the runtime rejects app files outside the artifact and environment registry origins. If your environment registry is on a separate origin that serves no code, you do not need it in `script-src`.
- **`script-src blob:`** is required because the ES module shim runs in shim mode, which rewrites module sources and executes them from `blob:` URLs.
- **`style-src 'unsafe-inline'`** is required because the bootstrap and runtime loading placeholders use inline `style` attributes, and the runtime writes rewritten app styles into `<style>` elements. Angular also inserts component styles as `<style>` elements.
- **`connect-src`** must include the artifact registry and the environment registry, because the loader and the shim fetch manifests and module sources with `fetch()`. Add your own product API origins.
- **`img-src` and `font-src`** must include the artifact registry for assets that apps publish.

`npx atlas verify` does not check CSP. Roll a new policy out with `Content-Security-Policy-Report-Only` first, then load every route and slot and watch the violation reports before you enforce it.

#### Local overrides from Columbus

[Columbus](../guides/columbus.md) substitutes local builds served from loopback addresses. The reference policy above blocks them, which is a reasonable default for production. To let developers use Columbus against a deployed host, add loopback sources to `script-src`, `style-src`, and `connect-src`:

```text
http://localhost:* http://127.0.0.1:* http://[::1]:*
```

Read [Security](security.md#columbus-overrides-in-production) before you add them: CSP is the only control that limits overrides on a deployed host.

### Recommended security headers

These headers are not required by Atlas, but they are good defaults for the host page:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Example: Nginx container

Atlas does not ship a server configuration. This example shows one way to satisfy the contract with the unprivileged Nginx image. Save it in your repository, for example as `deploy/nginx.conf`:

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;

  add_header Cache-Control "no-cache" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' blob: https://assets.example.com; style-src 'self' 'unsafe-inline' https://assets.example.com; connect-src 'self' https://assets.example.com; img-src 'self' data: https://assets.example.com; font-src 'self' https://assets.example.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  location ~* \.(?:js|json|css|map)$ {
    try_files $uri =404;
  }

  location / {
    try_files $uri /index.html;
  }
}
```

Then build an image that contains the bootstrap files:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine

COPY ./customer-host/dist/bootstrap /usr/share/nginx/html
COPY ./deploy/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
```

Provide `atlas.runtime.json` per environment at deploy time, for example by mounting it at `/usr/share/nginx/html/atlas.runtime.json` from a Kubernetes ConfigMap. The same image then runs in every environment.

## Next steps

- [Production deployment](production-deployment.md): publish and deploy releases that this bootstrap loads.
- [Security](security.md): the trust model behind these rules.
- [Production readiness](production-readiness.md): the checklist to complete before launch.
