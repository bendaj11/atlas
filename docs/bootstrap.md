# Host bootstrap

Bootstrap is small static site that starts Atlas runtime. It is separate from versioned host client so host client and apps can publish independently from web infrastructure.

## Build

Nx:

```bash
npx nx run customer-host:atlas:bootstrap
```

Direct CLI:

```bash
npx atlas build-bootstrap customer-host
```

Output defaults to `<host>/dist/bootstrap`:

```text
index.html
atlas.loader.js
atlas.runtime.json
nginx.conf
atlas.bootstrap.json
```

`atlas.bootstrap.json` lists files and deterministic SHA-256 digest. Same inputs produce same digest.

## Why bootstrap is separate

Host has two deployable parts:

- bootstrap: stable HTML/loader/runtime configuration served by web platform;
- host client: versioned federated artifact published to Atlas registry.

Combining them forces infrastructure rollout for every host-client release. Separation enables independent rollback and cache policy.

## CI reconciliation

CI should not inspect changed source paths to guess whether bootstrap changed. Generated `atlas:bootstrap` target declares inputs through workspace graph and produces deterministic digest.

Platform `deploy` target depends on `atlas:bootstrap`:

```json
{
  "deploy": {
    "dependsOn": ["atlas:bootstrap"],
    "executor": "nx:run-commands",
    "options": {
      "command": "./scripts/deploy-bootstrap.sh customer-host/dist/bootstrap"
    }
  }
}
```

Run normal workspace deployment:

```bash
npx nx affected -t atlas:publish deploy
```

Deployment platform compares digest, image tag, checksum, or GitOps input. Unchanged digest means no rollout.

## Docker and Nginx

Place Dockerfile in host project:

```dockerfile
FROM nginxinc/nginx-unprivileged:alpine
COPY ./dist/bootstrap /usr/share/nginx/html
COPY ./dist/bootstrap/nginx.conf /etc/nginx/conf.d/default.conf
```

Build after `atlas:bootstrap`:

```bash
docker build -t customer-host:<bootstrap-digest> customer-host
```

Generated Nginx config serves correct MIME types, prevents stale runtime configuration, applies immutable caching where appropriate, and falls back to `index.html` for routes.

## Static platforms

Deploy `dist/bootstrap` as static output on Vercel, Cloudflare Pages, S3 website hosting, or internal platform. Preserve file metadata and SPA fallback behavior. Registry/app objects remain in Atlas storage unless intentionally colocated.

## Runtime configuration

Example `atlas.runtime.json`:

```json
{
  "schemaVersion": "1",
  "hostId": "7ee210f9-dacd-4aac-939e-237032d44740",
  "hostVersion": "0.1.0",
  "catalogUrl": "https://assets.example/atlas/hosts/7ee210f9-dacd-4aac-939e-237032d44740/catalog.json",
  "allowCustomOverrides": false,
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

`catalogUrl` is derived from `ATLAS_REGISTRY_BASE_URL`. It is public download URL, not S3 upload endpoint.

Registry-backed PR and previous-production overrides are always available and
do not require a host flag. `allowCustomOverrides` controls only arbitrary
localhost/custom-URL execution. It defaults to false. The deprecated
`allowOverrides` field remains accepted as a compatibility alias.

## Custom HTML

Generated host includes `atlas.bootstrap.html`. Atlas uses it automatically:

```bash
npx atlas build-bootstrap customer-host
```

Choose another template:

```bash
npx atlas build-bootstrap customer-host --template other.bootstrap.html
```

Template must retain Atlas loader script and mount element expected by host.

## Verify

```bash
ATLAS_RUNTIME_URLS=https://portal.example/atlas.runtime.json npx atlas verify
```

Local container simulation:

```bash
docker run --rm -p 8080:8080 customer-host:local
ATLAS_RUNTIME_URLS=http://localhost:8080/atlas.runtime.json npx atlas verify
```

Local container tests production bytes and browser loading. It does not test remote TLS, ingress, CDN, identity, or network policy.
