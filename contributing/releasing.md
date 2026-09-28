---
title: Releasing Atlas packages
description: Learn how maintainers version, verify, bundle, and publish the Atlas package set.
---

# Releasing Atlas packages

This page explains how to release the Atlas npm packages. It is for maintainers of the Atlas source repository, which uses pnpm; Atlas consumers do not need pnpm.

## The release set

Atlas publishes seven packages as one compatible release set:

- `@atlas/schema`
- `@atlas/sdk`
- `@atlas/runtime`
- `@atlas/bootstrap`
- `@atlas/generators`
- `@atlas/testkit`
- `@atlas/cli`

All seven packages always share the same version. In the repository, packages depend on each other with `workspace:^`. In the published tarballs, those dependencies become the caret range of the release version, for example `^0.5.7`, and generated projects use a compatible caret range as well.

## Columbus is released separately

Columbus is not part of the Atlas package release set. It is a separately versioned Chrome extension, so do not align its version with an Atlas package version only because both changed in the same commit.

`pnpm release` and `pnpm release --verify` update and validate only the seven Atlas packages. They do not change the version in the Columbus `package.json` or Chrome `manifest.json`, and the Atlas release bundle does not contain a Columbus artifact.

When Columbus changes, bump its Chrome manifest version, build the extension, and distribute it through the extension's release channel. A Columbus release must state and test the Atlas versions it supports, because equal version numbers do not prove compatibility.

## Prepare a release

1. From the repository root, prepare the next version:

   ```sh
   pnpm release
   ```

   In an interactive terminal, the command asks you to choose `patch`, `minor`, or `major`. In scripts and other non-interactive environments, pass the release type or an exact version:

   ```sh
   pnpm release patch
   pnpm release 0.6.0
   ```

   The command updates the root `package.json`, every public package, and the Atlas version that generators emit. It then runs `pnpm pack:verify` and creates the release bundle in `dist/release`. It does not commit, push, or publish.

   > **Expected result:** The terminal prints `Prepared Atlas <version>. Update the changelog, commit, and tag v<version>.`, and `dist/release` contains seven tarballs, `SHA256SUMS`, and `release.json`.

2. Review the changes, and move the relevant entries from `Unreleased` in `CHANGELOG.md` to a new section for the version.

3. Commit the changes, and tag the reviewed commit as `v<version>`. The tag must match the package version exactly.

4. Push the tag. The Release bundle workflow in `.github/workflows/release.yml` repeats type checking, linting, unit tests, generated-project verification, and the browser end-to-end tests. It then runs `pnpm release --verify`, uploads `dist/release` as a workflow artifact, and attaches the bundle to the GitHub release for the tag. Rerunning the workflow for the same tag replaces the existing release assets with the newly verified bundle.

To rebuild the bundle for an already versioned commit without changing any files, run:

```sh
pnpm release --verify
```

## Publish the packages

Publish the complete package set with one command:

```sh
pnpm release:publish
```

By default, the command first runs `pnpm release --verify` to rebuild `dist/release`. It then checks the release manifest and every SHA-256 digest, and it publishes the packages in dependency order: schema, SDK, runtime, bootstrap, generators, testkit, and then CLI. Versions that already exist in the registry are skipped.

The command accepts these options:

| Option             | Effect                                                                   |
| ------------------ | ------------------------------------------------------------------------ |
| `--skip-build`     | Publishes the existing `dist/release` bundle instead of rebuilding it    |
| `--dry-run`        | Validates the bundle and runs `pnpm publish --dry-run` without uploading |
| `--registry <url>` | Overrides the registry URL                                               |
| `--tag <tag>`      | Sets the npm distribution tag                                            |
| `--access <value>` | Sets `public` or `restricted` access                                     |
| `--otp <code>`     | Passes a one-time password                                               |
| `--provenance`     | Publishes with provenance                                                |

Publishing automation should download the verified bundle from the tag's GitHub release into `dist/release` and run `pnpm release:publish --skip-build`, so the published tarballs are exactly the ones that CI verified.

Registry URLs, scoped registries, authentication, proxies, and custom certificate authorities come from the normal pnpm configuration, including the workspace or user `.npmrc`. For example:

```sh
pnpm release:publish --skip-build --registry https://registry.example.com --access restricted
```

> **Warning:** Never commit authentication tokens or store them in source files. Prefer `pnpm login`, a user-level `.npmrc`, or CI secrets. For npmjs.org, use trusted publishing or a short-lived token, require approval through a protected environment, and publish with `--provenance`.

Registries differ in how they treat scoped-package visibility, so configure `access=public` only when the target registry requires it.

## Package checks

Atlas is released under the MIT License. `pnpm pack:verify` builds and packs every public package, and it fails when any of the following is true:

- A package name, version, or description is missing or unexpected.
- A package version differs from the version that the generators emit.
- A package does not declare `main`, `types`, `exports`, and `files`, or a declared entry point is absent from its tarball.
- An internal Atlas dependency is not declared as `workspace:^`, or is not published as the caret range of the release version.
- The license metadata is not `MIT`, or the tarball does not contain the repository license text.
- The tarball contains source maps.

The static app registry and CDN publication flow is separate from package releases. Releasing Atlas packages does not upload any consumer app assets or catalogs.

## Related

- [Testing](testing.md)
- [Compatibility](../docs/reference/compatibility.md)
