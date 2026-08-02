# Releasing Atlas packages

These commands are for maintainers of the Atlas source repository, which uses
pnpm. They do not require Atlas consumers to use pnpm.

Atlas publishes seven packages as one compatible release set:

- `@atlas/schema`
- `@atlas/sdk`
- `@atlas/runtime`
- `@atlas/bootstrap`
- `@atlas/generators`
- `@atlas/testkit`
- `@atlas/cli`

They intentionally use the same version. Runtime packages pin other Atlas packages to that exact version, while generated applications use a compatible caret range.

## Prepare a release

Prepare the next version interactively:

```sh
pnpm release
```

Select `patch`, `minor`, or `major`. For scripts and other non-interactive
environments, pass the release type explicitly:

```sh
pnpm release patch
```

The command calculates and propagates the next version, builds verified package
archives, and creates `dist/release`. It does not commit, push, or publish. CI
can build an already-versioned tag without changing files:

```sh
pnpm release --verify
```

For an exact version, pass it directly: `pnpm release 0.2.0`.

The release command updates the root manifest, every public package, internal
Atlas dependency pins, the Columbus extension package and manifest, and the
version range emitted by generators. Chrome manifests use the numeric core of
a prerelease version. Tests remain separate test and CI commands.

Review the changes, move the relevant entries from `Unreleased` in the changelog
to a section for the new version, and tag the reviewed commit as `v<version>`.
The tag must exactly match the package version.

`pnpm release` creates `dist/release` with the seven verified tarballs,
`SHA256SUMS`, and `release.json`. Release CI preserves this exact directory as
an artifact and attaches it to the tag's GitHub release. Publishing automation must consume that artifact instead of
rebuilding packages from the tag. Package order is schema, SDK, runtime,
bootstrap, generators, testkit, then CLI.
Rerunning the tag workflow replaces existing GitHub release assets with the newly verified bundle.

## Publishing policy

Publish the complete package set with one command:

```sh
pnpm release:publish
```

The command verifies the release bundle, validates every SHA-256
digest, and publishes packages in dependency order. Existing immutable
versions are skipped. Use `--dry-run` to validate without uploading.

Registry URLs, scoped registries, authentication, proxies, and custom
certificate authorities come from normal pnpm configuration, including the
workspace or user `.npmrc`. `--registry`, `--tag`, `--access`, `--otp`, and
`--provenance` are optional command-line overrides:

```sh
pnpm release:publish --registry https://registry.example.com --access restricted
```

Do not commit authentication tokens. Prefer `pnpm login`, a user-level
`.npmrc`, or CI secret configuration. Registries differ on scoped-package
visibility, so configure `access=public` only when the target requires it.

Atlas is released under the MIT License. Every package tarball includes the
license text, and package verification rejects different license metadata.

The tag workflow remains available for immutable GitHub release artifacts. It
repeats type checking, unit tests, clean-room generator verification, and
browser E2E tests before creating the release artifact.

For npmjs.org, use trusted publishing or a short-lived token, require approval through a protected environment, and publish with provenance. Never store a registry token in source files.

## Package checks

`pnpm pack:verify` rejects:

- a package missing its JavaScript or TypeScript entry point;
- internal Atlas dependencies pointing at another release;
- a generator that emits a different Atlas version;
- incomplete package metadata or package contents.
- missing or incorrect MIT license metadata and text.
- source maps in public package tarballs.

The static app registry and CDN publication flow is separate. Releasing Atlas packages does not upload consumer app assets or catalogs.
