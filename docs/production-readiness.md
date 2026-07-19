# Production Readiness

Audience: release approver. Prerequisites: deployed bootstrap, public registry,
published host client/app, and runtime URL. This is a gate, not setup tutorial;
use [Production deployment](production-deployment.md) first.

Use this checklist before an Atlas host or app receives production traffic.
Complete it once for the platform, then repeat release-specific checks for every
app version.

Baseline review covers owners, host behavior, registry/CDN configuration, and
security controls. Repeat app, publication, verification, and warning review for
every release. Repeat rollback rehearsal after delivery-process changes and on
your incident-readiness schedule.

Atlas verifies deployed files and policies it can observe over HTTP. Your team
still owns authentication, storage permissions, monitoring, release approval,
and incident response.

## Assign Owners

Name an owner for each domain before release:

| Domain | Owner is responsible for |
| --- | --- |
| Host | Page shell, auth, layout anchors, host services, deep links, CSP, and runtime monitoring |
| App | Feature behavior, inner routes, assets, SDK usage, tests, and release identity |
| Deployment | Registry locking, upload order, cache policy, CORS, verification, rollback, and audit trail |

## Host Checklist

- [ ] Production serves `/atlas.runtime.json` as JSON.
- [ ] Runtime `hostId` matches app route and slot declarations.
- [ ] Runtime `catalogUrl` points to the intended environment.
- [ ] Runtime `allowCustomOverrides` matches environment policy. Registry PR
  and historical overrides are always available. If custom overrides are
  enabled, extension distribution and environment access restrict who may
  substitute code. Deprecated `allowOverrides` is migrated.
- [ ] Resource timeout and retry values match product reliability targets.
- [ ] Host layout retains route, navigation, status, and required slot anchors.
- [ ] Host returns `index.html` for browser navigation routes such as
  `/orders/42`, but never rewrites missing Atlas JSON, JavaScript, stylesheet,
  or CDN assets to `index.html`.
- [ ] Real auth, HTTP, modal, toast, host data, and monitoring providers replace
  generated placeholders.
- [ ] Loading and failure UI is usable and accessible.
- [ ] Runtime observation events reach production monitoring without breaking
  host execution when monitoring fails.

## App Checklist

- [ ] `atlas.config.ts` uses a stable app id and the correct framework.
- [ ] Every route and slot names an approved host id and existing host anchor.
- [ ] Route base paths do not conflict with another selected app.
- [ ] Inner routes stay scoped to the app's assigned base path.
- [ ] Cross-app navigation uses the Atlas SDK.
- [ ] Host-dependent behavior uses typed SDK contracts instead of importing host
  source.
- [ ] Asset URLs are imports or relative URLs, not host-root `/assets/...` URLs.
- [ ] Framework tests cover useful success, empty, loading, and failure states.
- [ ] Integration testing covers the app inside a real host.
- [ ] Package/workspace release version is correct; Atlas-derived content build
  ID uniquely identifies bytes and HTTP metadata within that version.
- [ ] CI uses a project-pinned `@atlas/cli` version and committed lockfile, not a
  floating global CLI.

## Registry And CDN Checklist

- [ ] Protected CI identity is the only publisher.
- [ ] Multi-file publication holds an expiring, renewable deployment lease from
  live registry read through public verification. A lock-free provider transaction is acceptable
  only when it atomically protects the entire mutable set; single-object
  compare-and-swap is insufficient.
- [ ] Lease ownership is checked before mutable replacement and after verification.
- [ ] Immutable files upload before mutable indexes and host catalogs.
- [ ] Immutable host/app bytes publish first, `registry.json` publishes before artifact indexes, and host catalogs publish
  last.
- [ ] Existing version/build paths are conditionally created and never overwritten.
- [ ] Publisher reads and HEADs stored objects to verify SHA-256, MIME, and cache policy.
- [ ] Immutable assets use long-lived immutable caching.
- [ ] Runtime files, catalogs, and indexes revalidate or receive explicit CDN
  invalidation.
- [ ] `remoteEntry.json` uses `application/json`.
- [ ] JavaScript modules use `text/javascript` or `application/javascript`.
- [ ] Approved host origins can `GET` and `HEAD` required remote files through
  CORS.
- [ ] Missing JSON and JavaScript return an error instead of host `index.html`.
- [ ] HTTPS is used for all production host, catalog, manifest, and asset URLs.
- [ ] New selection is exercised through a staging or canary catalog before
  production activation. If that is impossible, release plan documents the
  exposure window and automatic recovery path.

See [Static registry](registry.md) for revision and concurrency rules and
[Production deployment](production-deployment.md) for workspace-native publication flow.

## Security Checklist

- [ ] Host CSP permits only approved remote script and connection origins.
- [ ] Publication credentials are absent from source, generated output, and
  browser code.
- [ ] Dependency, secret, and static-analysis checks meet organization policy.
- [ ] Build artifacts and manifests have an auditable relationship to reviewed
  source.
- [ ] Team understands that Atlas apps share the host page; they are not isolated
  by cross-origin iframes.
- [ ] Access to publish both assets and manifests is treated as production code
  publishing access.

Read [security](security.md) before approving a new registry origin or publisher.

## Release Verification

`atlas verify` checks the public runtime file, selected host catalog, manifest
shape, one-version-per-app selection, route conflicts, external app dependencies,
remote entries, federation expose files, stylesheets, CORS, MIME types, cache
headers, and declared SHA-256 integrity. Cache and
missing-integrity findings can be warnings, so read the full report instead of
checking only the exit code.

It cannot prove browser rendering, authentication, SDK behavior, CSP enforcement,
storage permissions, publisher identity, atomic uploads, monitoring, accessibility,
or incident readiness. Test those separately below.

Run verification against the public runtime URL after CDN publication:

Commands below assume the current project contains the approved, pinned
`@atlas/cli` dependency and dependencies were installed from its lockfile.

```sh
npm exec --package=@atlas/cli -- atlas verify \
  --runtime-url=https://customer.example/atlas.runtime.json
```

If runtime config uses a separate origin, state the real host origin:

```sh
npm exec --package=@atlas/cli -- atlas verify \
  --runtime-url=https://config.example/customer/atlas.runtime.json \
  --host-origin=https://customer.example
```

Then complete browser smoke tests:

- [ ] Report contains no failures. Every warning other than missing production
  integrity is fixed or accepted by the final approver and a named risk owner
  with an expiry.
- [ ] Production manifests declare SHA-256 integrity for the remote entry and
  every stylesheet that supports integrity metadata; no missing-integrity
  warning remains.
- [ ] Host root loads without console errors.
- [ ] App base route loads the selected version.
- [ ] Nested route survives a full-page refresh.
- [ ] Critical images, styles, and lazy chunks load.
- [ ] Authenticated HTTP and other host SDK services work.
- [ ] Loading, timeout, and failure UI behaves as designed.
- [ ] Keyboard, focus, screen-reader, and automated accessibility checks cover
  host navigation plus app loading, success, empty, and failure states.
- [ ] Monitoring identifies host id, app id, version, build id, placement, and
  failure stage.

## Rollback Rehearsal

Use same protected storage settings and shared registry as release. Stop or wait
for concurrent publication before starting. Atlas owns lock acquisition,
revision check, catalog-last activation, verification, mutable restore on
failure, and lock release.

Before selection, confirm the exact target version/build is complete, reachable,
and compatible with current host and SDK contracts in staging or canary.

Prepare an earlier published version:

```sh
APP_ID=2bea9c13-4899-4f93-9211-cd8c55e9c529

npm exec --package=@atlas/cli -- atlas rollback "$APP_ID" \
  --version=1.3.2 \
  --build-id=1.3.2-build-123 \
  --registry-base-url=https://cdn.example.com/atlas \
  --dry-run

# After reviewing dry-run paths, run real rollback with verification.
npm exec --package=@atlas/cli -- atlas rollback "$APP_ID" \
  --version=1.3.2 \
  --build-id=1.3.2-build-123 \
  --registry-base-url=https://cdn.example.com/atlas \
  --runtime-url=https://customer.example/atlas.runtime.json
```

- [ ] `APP_ID` is stable UUID from app `atlas.config.ts`.
- [ ] Dry run lists only expected mutable files before real rollback.
- [ ] Mutable JSON is revalidated after rollback.
- [ ] Built-in verification passes after rollback publication.
- [ ] Browser smoke tests confirm the older version.
- [ ] On-call documentation names the decision maker and communication channel.
- [ ] Team knows how to stop a concurrent publication before rollback.

Rollback changes catalog selection. It does not rebuild an app, overwrite an
immutable version, or redeploy the host.

## Ready To Release

Release is ready when every applicable item has an owner and evidence, public
verification passes, smoke tests pass, monitoring is visible, and rollback has
been rehearsed in a production-like environment.

Record evidence as links to CI runs, verification output, smoke-test results,
monitoring views, security approval, and rollback rehearsal. Name the final
release approver and document any waived item with its risk owner and expiry.
Verification failures, absent publication concurrency protection, mutable-first
upload, immutable-path overwrite, and missing production integrity are not
waivable production conditions.

For test boundaries and fixtures, see [consumer testing](consumer-testing.md).
For browser symptoms, use [Angular troubleshooting](angular/troubleshooting.md)
or [React troubleshooting](react/troubleshooting.md).
