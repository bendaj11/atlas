# Releasing Atlas packages

Atlas publishes six packages as one compatible release set:

- `@atlas/contracts`
- `@atlas/sdk`
- `@atlas/runtime`
- `@atlas/generators`
- `@atlas/testkit`
- `@atlas/cli`

They intentionally use the same version. Runtime packages pin other Atlas packages to that exact version, while generated applications use a compatible caret range.

## Prepare a release

Choose the next semantic version and run:

```sh
yarn release:version 0.2.0
yarn typecheck
yarn test
yarn test:generated
yarn test:e2e
yarn release:bundle
```

`release:version` updates the root manifest, every public package, internal Atlas dependency pins, the Chrome extension package and manifest, and the version range emitted by generators. Chrome manifests use the numeric core of a prerelease version. `test:generated` packs those packages and proves that the packaged CLI can generate and production-build Angular and React hosts and MFs.

Review the changes, move the relevant entries from `Unreleased` in the changelog
to a section for the new version, and tag the reviewed commit as `v<version>`.
The tag must exactly match the package version.

`release:bundle` creates `dist/release` with the six verified tarballs,
`SHA256SUMS`, and `release.json`. Release CI preserves this exact directory as
an artifact and attaches it to the tag's GitHub release. Publishing automation must consume that artifact instead of
rebuilding packages from the tag. Package order is contracts, SDK, runtime,
generators, testkit, then CLI.
Rerunning the tag workflow replaces existing GitHub release assets with the newly verified bundle.

## Publishing policy

The included workflow publishes to npmjs.org only through a manual dispatch
of a tag with `publish_packages` enabled. Protect the `npm-publish` GitHub
environment with required reviewers and configure `NPM_TOKEN` (or adapt the
job to npm trusted publishing). The job verifies checksums, publishes the
downloaded tarballs in dependency order, and uses npm provenance.

Organizations using Artifactory, GitHub Packages, or another compatible
registry can replace that protected job while retaining the same artifact,
checksum, approval, and package-order guarantees.

Atlas is released under the MIT License. Every package tarball includes the
license text, and package verification rejects different license metadata.

The tag workflow repeats type checking, unit tests, clean-room generator
verification, and browser E2E tests before creating the release artifact.

For npmjs.org, use trusted publishing or a short-lived token, require approval through a protected environment, and publish with provenance. Never store a registry token in source files.

## Package checks

`yarn pack:verify` rejects:

- a package missing its JavaScript or TypeScript entry point;
- internal Atlas dependencies pointing at another release;
- a generator that emits a different Atlas version;
- incomplete package metadata or package contents.
- missing or incorrect MIT license metadata and text.
- source maps in public package tarballs.

The static MF registry and CDN publication flow is separate. Releasing Atlas packages does not upload consumer MF assets or catalogs.
