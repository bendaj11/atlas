---
title: Security
description: The Atlas trust model, what the loader and runtime verify, how Columbus overrides behave on deployed hosts, and the controls your team owns.
---

# Security

This page explains what Atlas protects, what it does not, and which controls your platform and security teams must own. It is for host owners, platform engineers, and security reviewers. Read [Architecture](../introduction/architecture.md) and [Host bootstrap](bootstrap.md) first.

To report a vulnerability in Atlas itself, follow the [security policy](../../SECURITY.md).

## Trust model

Atlas loads executable browser code from object storage and runs it in your product's page. Three consequences follow:

- **Publish access is production code access.** Anyone who can publish a release and deploy it can run code for every user of the affected hosts. Integrity checks do not change this: they prove that bytes match their manifest, not that the manifest is trustworthy.
- **Apps share the host page.** Apps run in the same JavaScript realm and origin as the host. Shadow DOM isolates styles and DOM queries; it is not a security boundary. Atlas is not designed to run untrusted third-party code. Use cross-origin iframes for that.
- **The host is more privileged than any app.** The host controls routing, layout, the SDK services it provides, authentication integration, and every app mount.

The bootstrap, `atlas.runtime.json`, the registries, and every manifest are public browser content. Never put OAuth client secrets, sessions, tokens, private storage URLs, or storage credentials in them. Atlas does not proxy registry requests.

## What the loader and runtime verify

Before the loader imports a host, it checks that:

- `atlas.runtime.json` is valid and contains only known fields.
- Every artifact manifest matches the size and SHA-256 digest recorded in the host deployment manifest.
- The host catalog and host manifest belong to the `hostId` in the runtime config.
- The host manifest declares an entry expose and requires a compatible loader API major version.
- The published host's remote entry and stylesheets use HTTPS on the `artifactRegistryUrl` origin. HTTP is accepted only when both the file and the registry use loopback addresses.
- The host remote entry matches its SHA-256 integrity value, when the manifest declares one.

When the runtime mounts apps, it checks that each published app's remote entry and stylesheets use HTTP(S) on the artifact or environment registry origin. Local-channel manifests may only use loopback URLs. Stylesheets that declare integrity load with Subresource Integrity.

`npx atlas verify` repeats many of these checks from outside the browser. It does not check CSP, authentication, or the behavior of your code.

## Integrity and immutability

Release paths (`apps/<id>/<version>/**` and `hosts/<id>/<version>/**`) are written with create-only requests. Publishing different bytes under an existing version fails. Deploy changes only the environment files that select releases; it never modifies a published release.

Manifests can carry SHA-256 integrity values for remote entries and stylesheets. `npx atlas verify` warns when a production manifest lacks them.

## Columbus overrides in production

[Columbus](../guides/columbus.md) lets developers replace a host or app on a real page with a local build or another published release. This works on deployed production hosts too. Atlas has no setting that turns overrides off for an environment.

### How overrides reach a deployed host

- On every page load, the loader reads an override document from `sessionStorage`, then `localStorage`, under the key `atlas.runtime-overrides`. The document applies only when its `hostId` matches the runtime config.
- When the Columbus extension is installed, it runs on every HTTP and HTTPS page. The loader asks it for a development session, and Columbus offers local builds from a running `npx atlas dev` unless the developer dismissed them.
- An override stored in `localStorage` persists across sessions until someone clears it. The startup error page and Columbus can both clear overrides.

### What limits an override

- A local-channel override can load files only from loopback addresses (`localhost`, `127.0.0.1`, `[::1]`) on any port.
- A published override must resolve to a release in a registry, and its files must pass the same origin checks as normal releases. An override cannot load code from an arbitrary internet origin.
- A published override can select any release or pull request preview that exists in the artifact registry the host uses, including builds that were never deployed.

### The risk

Anyone who can write to the host origin's storage can make the host load a different build for that browser. In practice this means:

- A cross-site scripting bug on the host origin can be turned into a persistent compromise by storing an override.
- A process listening on a loopback port on a developer's machine can serve code into a production page when loopback sources are allowed.
- A preview build runs with the user's real production session and data.

### Controls you can apply

- **CSP.** Leave loopback sources out of `script-src` and `connect-src` on production hosts, as in the [reference policy](bootstrap.md#write-a-content-security-policy). This blocks local overrides; it does not block published previews from the same registry.
- **Registry separation.** Publish pull request previews to a registry that production hosts do not use as their `artifactRegistryUrl`, so previews cannot be selected on production.
- **Browser management.** Use your browser management policy to control who can install the Columbus extension.
- **Awareness.** Tell support staff to ask users to clear overrides when a page behaves unexpectedly.

## Publication controls

- Pin `@atlas/cli` and all dependencies with a committed lockfile.
- Build once, publish the exact output once, and deploy those same bytes to every environment.
- Give storage write permissions only to protected CI identities.
- Let the Atlas publication lock serialize registry writes. For S3, the lock is an object under your key prefix; set `ATLAS_S3_LOCK_MODE=external` only when an external coordinator serializes every writer. For Artifactory, see [Publish with Artifactory](artifactory.md).
- Run `npx atlas verify` against the public host after each deploy.
- Roll back by deploying an older exact version.
- Keep audit logs of publish, deploy, and rollback jobs.

Never fix a release by editing `registry.json` or a host deployment manifest by hand. Publish new bytes, then deploy them.

## Host platform controls

The host server serves static files only. Give it no storage write credentials. Configure CSP, CORS, MIME types, and caching as described in the [host platform contract](bootstrap.md#host-platform-contract). Make sure no proxy or CDN transforms JavaScript, JSON, or CSS, because that breaks integrity checks. Apply your organization's standards for TLS, image scanning, and runtime hardening to the server.

## Next steps

- [Host bootstrap](bootstrap.md): the CSP, headers, and caching reference.
- [Governance](governance.md): publish permissions and ownership across teams.
- [Production readiness](production-readiness.md): the security checklist before launch.
