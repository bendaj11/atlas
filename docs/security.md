# Security

Audience: host, platform, and security owners. Read [Architecture](architecture.md)
and [Host server](host-server.md) first. App developers mainly follow origin,
SDK, and immutable-release rules; platform team owns runtime environment,
storage permissions, CSP, and override policy.

Atlas loads executable browser code from object storage. Treat registry publication as production code deployment.

## Trust levels

A host client is more privileged than an app. It controls routing, layout, SDK construction, authentication integration, telemetry, and all app mounts. Columbus displays host overrides separately and requires a stronger warning.

The host server is a separate trusted boundary. User extensions may hold OAuth
client credentials, sessions, or downstream tokens. Never expose them through
`/atlas.runtime.json`, and do not give server publication-storage credentials.
Default Atlas core does not proxy registry artifacts.

## Runtime policy

Production server configuration should normally include:

```sh
ATLAS_ALLOW_OVERRIDES=false
ATLAS_ASSET_ORIGINS=https://cdn.example.com
ATLAS_EXTERNAL_REGISTRY_URLS=https://shared-ui.example/atlas
```

Atlas does not add catalog origin to CSP automatically. Every cross-origin
catalog or artifact/CDN origin must appear in `ATLAS_ASSET_ORIGINS`.
`ATLAS_EXTERNAL_REGISTRY_URLS` explicitly limits cross-registry dependency
discovery and adds those registry origins to CSP. Production URLs require HTTPS.
Local overrides require HTTP(S) loopback.

`/atlas.runtime.json` is public browser data. Never expose passwords, tokens, connection strings, or private storage credentials through environment values returned there.

## Loader validation

Before importing a host client, the stable loader validates:

- runtime, catalog, and host ids agree;
- catalog contains exactly one host and an app array;
- host manifest kind is `host`;
- loader API major is compatible;
- URL scheme and origin satisfy runtime policy;
- local URL uses loopback;
- declared SHA-256 SRI matches remote federation metadata;
- required `./host` expose exists.

The host client receives the validated effective host/app catalog and must not resolve a second host/app selection. Widget resolver may lazily read approved registry production pointers for `getWidget`.

External registry manifests and assets receive same scheme, origin, integrity, framework lifecycle, duplicate-ID, and compatibility checks. Registry failure stays inside requested widget's card; it does not disable unrelated apps or widgets.

## Integrity and immutability

Production builds include SHA-256 integrity for remote metadata and styles. Version/build object paths are immutable and uploaded with create-only writes. Reusing a build id for different bytes is an error.

Integrity does not replace publication authorization. Anyone who can publish both artifacts and manifests can execute code in the product. Protect storage credentials, registry lease operations, CI variables, and approval environments accordingly.

## Publication controls

- Pin Atlas CLI and dependencies with a committed lockfile.
- Build once; promote the same publication directory between environments.
- Grant immutable create and mutable replace permissions only to protected CI.
- Serialize all host/app releases sharing one registry root.
- Compare live registry revision before mutation.
- Upload immutable bytes before active catalogs.
- Verify runtime after activation while still holding the lease.
- Restore previous mutable files on verification failure.
- Keep deployment and rollback audit logs.

Never fix a release by editing `catalog.json` in a CDN console.

## HTTP controls

The host server sets CSP, disables framework disclosure, adds `nosniff`, a referrer policy, and frame restrictions. Configure `ATLAS_ASSET_ORIGINS` so CSP includes every approved CDN origin. Native Federation creates inline import maps and blob-backed script, connection, and style shims, so those directives permit the required inline/blob operations; Atlas still limits network assets to the host and configured asset origins. TLS termination may occur at the deployment platform.

Object storage/CDN must:

- serve correct JavaScript, JSON, and CSS content types;
- allow CORS from intended host origins;
- revalidate mutable JSON;
- cache immutable version/build paths long term;
- avoid content transformation that breaks integrity hashes.

## Override recovery

An invalid host can fail before product error boundaries exist. The loader owns recovery UI and can clear both tab and all-tabs overrides. Columbus can also reset overrides without host-client cooperation.

Enable overrides only in environments where developer substitution is intended. When enabled, the server CSP permits loopback HTTP ports so Columbus can connect local host/app builds; non-loopback network assets remain limited to configured origins. A production troubleshooting environment may enable overrides for authorized users, but the setting itself does not provide authentication; browser-extension distribution and environment access remain organizational controls.

## Runtime hardening

Atlas server core is stateless, logs to stdout/stderr, handles `SIGTERM`, and exposes separate health paths. Generated server extensions determine final state and resource needs. Give server no object-storage write credentials. Apply runtime hardening, resource limits, network policy, scanning, signing, and admission controls according to organizational standards and chosen deployment technology.
