# Security policy

This page explains how to report a security vulnerability in Atlas privately. It covers the `@atlas/*` packages and the Columbus browser extension in this repository.

## Supported versions

Atlas is pre-1.0 software. The seven `@atlas/*` packages are released together with one shared version, and security fixes are made in the latest release. Upgrade to the latest version before you report an issue, and check whether it still occurs. The [project status and support](docs/reference/compatibility.md#project-status-and-support) section describes the current release and the stability you can expect.

Columbus is versioned separately. Fixes for Columbus ship in its latest release.

## Report a vulnerability

Do not open a public issue, discussion, or pull request for a security vulnerability.

Report it privately through GitHub's private vulnerability reporting:

1. Open the repository's **Security** tab on GitHub.
2. Select **Report a vulnerability**.
3. Describe the issue.

Include as much of the following as you can:

- The affected package or Columbus, and its version.
- The impact, for example code execution in a Host page, a bypass of artifact integrity or origin checks, or exposure of storage credentials.
- Steps to reproduce, ideally with a minimal Host, App, and `atlas.runtime.json`.
- Any suggested fix.

If private reporting is not available on the repository, open a public issue that asks the maintainers for a private contact, without including any details of the vulnerability.

## What happens next

The maintainers review the report, confirm or dismiss it, and coordinate a fix and disclosure through a GitHub security advisory. Please keep the details private until an advisory is published.

## Scope

In scope: flaws in Atlas code, such as the loader accepting an artifact from an origin it should reject, integrity checks that can be bypassed, the CLI leaking credentials, or Columbus exposing overrides to other sites.

Out of scope: behavior that Atlas documents as your responsibility, such as your Host's Content Security Policy, storage permissions, or CI credentials, and limits that Atlas documents as known, such as the browser not verifying lazy JavaScript chunks. The [deployment security guide](docs/deploy/security.md) describes the Atlas trust model and those responsibilities.
