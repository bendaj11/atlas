---
title: Production readiness
description: A release-gate checklist for Atlas Hosts and Apps, including verification, monitoring with runtime events, and rollback rehearsal.
---

# Production readiness

Use this checklist before an Atlas Host or App receives production traffic. It is for the release approver and assumes you have already completed [Production deployment](production-deployment.md) in a staging environment.

Complete the platform sections once, then repeat the App, verification, and smoke-test sections for every release. Rehearse rollback after any change to the delivery process.

Atlas verifies the files and headers it can observe over HTTP. Your team still owns authentication, storage permissions, monitoring, release approval, and incident response.

## Assign owners

Name an owner for each area before release:

| Area       | Owner is responsible for                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Host       | Page layout, authentication, host anchors, Host SDK services, deep links, CSP, and monitoring. |
| App        | Feature behavior, inner routes, assets, SDK usage, tests, and release versions.                |
| Deployment | Storage permissions, publication lock, cache policy, CORS, verification, rollback, and audit.  |

## Host checklist

- [ ] The Host origin serves `/atlas.runtime.json` as JSON with `Cache-Control: no-cache`.
- [ ] The runtime config `hostId` matches the Host's `atlas.config.ts`, and `environment` names the intended environment.
- [ ] `artifactRegistryUrl` (and `environmentRegistryUrl`, if set) point at the production registries.
- [ ] The Host layout keeps the route outlet, status, and every slot that Apps target. See [host anchors](../concepts/host-anchors.md).
- [ ] Browser navigation routes such as `/orders/42` return `index.html`, but missing `.js`, `.json`, and `.css` files return `404`.
- [ ] Real authentication, host data, and monitoring providers, and any Host-defined SDK extensions such as an HTTP client, replace generated placeholders.
- [ ] Loading and failure states are usable and accessible.
- [ ] The Host passes an `observe` callback and runtime events reach monitoring. See [Monitor the runtime](#monitor-the-runtime).

## App checklist

- [ ] `atlas.config.ts` has a stable App `id` and the correct framework.
- [ ] Every route and slot names an approved Host ID and an existing host anchor.
- [ ] No route path conflicts with another App deployed to the same Host. See [Governance](governance.md#route-and-slot-ownership).
- [ ] Inner routes stay inside the App's assigned path, and cross-App navigation uses the SDK.
- [ ] Host-dependent behavior uses typed SDK contracts instead of importing Host source.
- [ ] Asset URLs are imports or paths under `assets/` (`/assets/...`, `./assets/...`, or `assets/...`). The runtime rewrites only those paths to the App's release folder; other root-relative paths such as `/images/logo.png` resolve against the Host origin.
- [ ] Tests cover success, empty, loading, and failure states, and integration tests run the App inside a real Host. See [Testing Apps and Hosts](../guides/testing-apps-and-hosts.md).
- [ ] CI uses the project's pinned `@atlas/cli` and a committed lockfile.

## Registry and CDN checklist

- [ ] Only protected CI identities can write to registry storage.
- [ ] Every publish, deploy, and preview cleanup job uses the Atlas publication lock. For Artifactory, every writer runs inside the shared external lock described in [Publish with Artifactory](artifactory.md).
- [ ] Every registry and Host file is served with the `Cache-Control` value in the [caching table](bootstrap.md#set-cache-headers), and your CDN passes it through or invalidates mutable files after each publish and deploy.
- [ ] JSON is served as `application/json`, JavaScript as `text/javascript`, and CSS as `text/css`.
- [ ] Every registry file allows the Host origin through CORS for `GET` and `HEAD`.
- [ ] Missing registry files return an error, never the Host's `index.html`.
- [ ] All Host, registry, and asset URLs use HTTPS.
- [ ] New releases run in staging before production. If that is impossible, the release plan states the exposure window and the recovery path.

Publish writes release files first and then adds them to `registry.json`. Deploy writes `environments/<environment>/deployment.json` and then the host deployment manifest `environments/<environment>/hosts/<hostId>/manifest.json` of each affected Host. Deploy never writes `registry.json` or copies release files. See the [registry reference](../reference/registry.md).

## Security checklist

- [ ] The Host CSP follows the [reference policy](bootstrap.md#write-a-content-security-policy) and was tested in report-only mode.
- [ ] The team has decided whether production CSP allows loopback sources for [Columbus overrides](security.md#columbus-overrides-in-production).
- [ ] Storage credentials are absent from source, build output, and browser files.
- [ ] Dependency, secret, and static-analysis checks meet your organization's policy.
- [ ] Every published release can be traced to reviewed source.
- [ ] The team understands that Apps share the Host page and are not isolated like cross-origin iframes.
- [ ] Permission to publish or deploy is granted and reviewed as production code access.

## Verify the release

Run verification against the public Host after the CDN serves the new deployment:

```sh
npx atlas verify --host-url https://customer.example.com
```

The `verify` command checks the runtime config, the host deployment manifest, referenced published artifact manifests, route conflicts, remote entries, federation exposes, stylesheets, CORS, MIME types, cache headers, and declared SHA-256 integrity. Cache and missing-integrity findings are warnings, so read the whole report instead of checking only the exit code.

It cannot prove rendering, authentication, SDK behavior, CSP enforcement, storage permissions, or accessibility. Cover those with the smoke tests below.

- [ ] The report contains no failures.
- [ ] Every warning is fixed, or accepted by the release approver with a named risk owner and an expiry date.
- [ ] Production manifests declare SHA-256 integrity; no missing-integrity warning remains.

## Run browser smoke tests

- [ ] The Host root loads without console errors.
- [ ] Each App's base route loads the selected version.
- [ ] A nested route survives a full-page refresh.
- [ ] Critical images, styles, and lazy chunks load.
- [ ] Product APIs and Host SDK services work.
- [ ] Loading, timeout, and failure states behave as designed.
- [ ] Keyboard, focus, screen reader, and automated accessibility checks cover Host navigation and App states.

## Monitor the runtime

The Atlas runtime reports diagnostics through an optional `observe` callback that the Host provides. In a React Host, return `observe` from `useSdkOptions`. In an Angular Host, set `observe` in `sdkOptions`. Atlas ignores errors thrown by the callback, so a monitoring failure cannot break the Host.

```ts
import type { AtlasRuntimeEvent } from '@atlas/runtime';

export function observeAtlas(event: AtlasRuntimeEvent): void {
  navigator.sendBeacon(
    '/telemetry/atlas',
    JSON.stringify({ ...event, error: event.error?.message }),
  );
}
```

The runtime emits these events. Every event has a `type` and an ISO `timestamp`.

| Type                | Fields                                                                          | Emitted when                                                              |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `host.start`        | `hostId`                                                                        | The Host runtime starts.                                                  |
| `host.ready`        | `hostId`, `durationMs`                                                          | The Host runtime is ready.                                                |
| `host.error`        | `hostId`, `durationMs`, `error`                                                 | The Host runtime fails to start.                                          |
| `operation.success` | `stage`, `attempt`, `maxAttempts`, `durationMs`, `resource`, `appId`, `version` | A runtime operation succeeds.                                             |
| `operation.retry`   | Same as `operation.success`, plus `error`                                       | An operation failed and will be retried.                                  |
| `operation.error`   | Same as `operation.success`, plus `error`                                       | An operation failed after its last attempt or with a non-retryable error. |
| `app.state`         | `hostId`, `appId`, `version`, `placementId`, `state`, `error`                   | An App placement changes state.                                           |

`stage` is one of `manifest`, `integrity`, `federation-init`, `remote-module`, or `exported-widget`. `state` is one of `mounting`, `loading`, `mounted`, `error`, or `unmounted`.

Failures inside the bootstrap loader happen before the runtime exists, so they do not reach `observe`. The loader shows its startup error page and logs to the browser console. To capture them, add your error-monitoring script to the Host's `atlas.bootstrap.html` template.

Suggested alerts:

- **Host start failures.** Any rise in `host.error` events or startup error pages after a deploy. Page the Host owner.
- **App mount failures.** `app.state` events with `state: "error"`, grouped by `appId` and `version`. A spike right after a deploy points at that release; roll it back.
- **Integrity failures.** Any `operation.error` with `stage: "integrity"`. Unless the error is a network failure, served bytes do not match their manifest, for example because a CDN transforms files. Investigate it as a possible security event.
- **Registry or CDN degradation.** A rising rate of `operation.retry` events, grouped by `resource`.
- **Startup regressions.** The 95th percentile of `durationMs` on `host.ready`, compared with the previous release.

## Rehearse rollback

Rehearse rollback in a production-like environment with the same storage and registry setup as production.

1. Confirm that the older version you will roll back to is published and still compatible with the current Host.
2. Run a dry run and review the selection it prints.

   ```sh
   npx atlas deploy orders --to production --version 1.3.2 --dry-run
   ```

3. Roll back, then verify the Host.

   ```sh
   npx atlas deploy orders --to production --version 1.3.2
   npx atlas verify --host-url https://customer.example.com
   ```

   > **Expected result:** Verification passes and browser smoke tests show the older version.

- [ ] The dry run resolved only the intended artifact and version.
- [ ] Verification and smoke tests passed after the rollback.
- [ ] On-call documentation names the decision maker and the communication channel.
- [ ] The team knows how to rerun a deploy that failed partway. See [Recover from a failed deploy](production-deployment.md#recover-from-a-failed-deploy).

## Ready to release

A release is ready when every applicable item has an owner and evidence, verification and smoke tests pass, monitoring is visible, and rollback has been rehearsed.

Record evidence as links to CI runs, verification output, smoke-test results, monitoring dashboards, security approval, and the rollback rehearsal. Name the release approver and document every waived item with its risk owner and expiry. Verification failures, missing publication locking, and missing production integrity cannot be waived.

## Next steps

- [Security](security.md): the trust model behind this checklist.
- [Governance](governance.md): ownership and permissions across teams.
- [Troubleshooting](../troubleshooting.md): diagnose browser and deployment symptoms.
