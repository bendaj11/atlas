# Security

Audience: host, platform, and security owners. Read [Architecture](architecture.md)
and [Static bootstrap](bootstrap.md) first. App developers mainly follow origin,
SDK, and immutable-release rules; platform team owns host discovery, storage
permissions, CSP, and override policy.

Atlas loads executable browser code from object storage. Treat publication
credentials and environment deployment selection as production-code controls.

## Trust levels

A host client is more privileged than an app. It controls routing, layout, SDK construction, authentication integration, telemetry, and all app mounts. Columbus displays host overrides separately and requires a stronger warning.

Static bootstrap is public browser content. Never put OAuth client secrets,
sessions, downstream tokens, or publication-storage credentials in it. Atlas
does not proxy registry artifacts.

## Runtime policy

Generate static bootstrap with the stable public registry URL:

```sh
atlas bootstrap customer-host \
  --registry-url=https://assets.example.com/atlas \
  --asset-origins=https://cdn.example.com,https://shared-ui.example
```

`--asset-origins` defines browser origins in runtime policy. Configure matching
origins in your web server CSP. The generated Nginx configuration receives its
CSP origins from `atlas bootstrap --asset-origins`.
Production URLs require HTTPS; local development permits HTTP(S) loopback.

`atlas.runtime.json` and environment host manifests are public browser data.
Never expose passwords, tokens, connection strings, private storage API URLs,
or credentials in them. Platform/IaC owns runtime config; Atlas generates host
manifests from validated public settings.

## Loader validation

Before importing a host client, the stable loader validates:

- bootstrap, discovery, active deployment manifest, and host ids agree;
- active deployment manifest contains exactly one host descriptor and an app array;
- referenced canonical host manifest kind is `host-artifact`;
- loader API major is compatible;
- URL scheme and origin satisfy runtime policy;
- local URL uses loopback;
- declared SHA-256 SRI matches remote federation metadata;
- required `./host` expose exists.

The host client receives the validated, hydrated effective host/app catalog and
must not resolve a second host/app selection. This catalog is an internal mount
payload. Widget resolver may lazily read
approved registry environment selections for `getWidget`.

External registry manifests and assets receive same scheme, origin, integrity, framework lifecycle, duplicate-ID, and compatibility checks. Registry failure stays inside requested widget's card; it does not disable unrelated apps or widgets.

## Integrity and immutability

Production builds include SHA-256 integrity for remote metadata and styles.
Release-version object paths are immutable and uploaded with create-only writes.
Publishing different bytes under an existing version is an error.

Integrity does not replace publication authorization. Anyone who can publish both artifacts and manifests can execute code in the product. Protect storage credentials, registry lease operations, CI variables, and approval environments accordingly.

## Publication controls

- Pin Atlas CLI and dependencies with a committed lockfile.
- Let workspace runner build once; publish exact output once, then deploy those
  bytes across environments.
- Grant immutable create and mutable replace permissions only to protected CI.
- Allow native runner concurrency; Atlas storage lease serializes registry mutation.
- Read and compare live registry only while holding expiring, renewable lease.
- Upload immutable bytes before their registry descriptor; deploy desired state
  before converging affected active host manifests.
- Read and HEAD uploaded objects; verify SHA-256, MIME, and cache policy.
- Verify the public host after active host convergence.
- Resume partial convergence safely; roll back by deploying an older exact
  version when required.
- Keep deployment and rollback audit logs.

Never fix a release by editing `registry.json` or an active host manifest in a
CDN console. Publish immutable bytes, then deploy the selected release.

## HTTP controls

Generated Nginx config sets CSP, `nosniff`, referrer policy, and frame restrictions. Configure `--asset-origins` so CSP includes every approved CDN origin. Native Federation creates inline import maps and blob-backed script, connection, and style shims, so directives permit required inline/blob operations while limiting network assets to configured origins. TLS termination may occur at deployment platform.

Object storage/CDN must:

- serve correct JavaScript, JSON, and CSS content types;
- allow CORS from intended host origins;
- revalidate mutable JSON;
- cache immutable release-version paths long term;
- avoid content transformation that breaks integrity hashes.

## Override recovery

An invalid host can fail before product error boundaries exist. The loader owns recovery UI and can clear both tab and all-tabs overrides. Columbus can also reset overrides without host-client cooperation.

Enable overrides only where developer substitution is intended. When enabled,
generated CSP permits loopback HTTP ports so Columbus can connect local builds;
non-loopback assets remain limited to configured origins. Setting does not
provide authorization; extension distribution and environment access remain
organizational controls.

## Runtime hardening

Atlas server core is stateless, logs to stdout/stderr, handles `SIGTERM`, and exposes separate health paths. Generated server extensions determine final state and resource needs. Give server no object-storage write credentials. Apply runtime hardening, resource limits, network policy, scanning, signing, and admission controls according to organizational standards and chosen deployment technology.
