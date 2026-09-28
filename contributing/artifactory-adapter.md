---
title: Artifactory adapter
description: Why Atlas ships its own Artifactory storage provider, what its tests cover, and the JFrog and Jenkins references it relies on.
---

# Artifactory adapter

This page records the design decision behind the built-in Artifactory storage provider and the scope of its test coverage. It is for contributors who change the provider in `packages/cli/src/publication/artifactory-client` and `packages/cli/src/publication/artifactory-storage`. The user-facing setup guide is [Publish with Artifactory](../docs/deploy/artifactory.md).

## Design decision

The Atlas team compared three options: REST code that each consumer writes, a provider that Atlas owns, and bulk uploads with the JFrog CLI. Atlas owns the reusable provider, so that consumers do not each reimplement integrity checks, immutable releases, metadata handling, and write handling. Consumers own their organization's credentials, external coordination, network setup, and delivery policy.

The JFrog CLI is a good fit for build archives and provenance. Uploading `dist` with it does not perform the Atlas registry and environment operations, so it cannot replace the `publish` and `deploy` commands.

## Test coverage

Automated contract tests cover the provider against a mocked Artifactory API. A live Artifactory instance, Jenkins cancellation behavior, and browser delivery remain acceptance checks for each organization that deploys Atlas. No live organization instance has been certified.

## References

- [JFrog deploy and checksum API](https://docs.jfrog.com/artifactory/reference/deployartifact)
- [JFrog storage and listing API](https://docs.jfrog.com/artifactory/reference/getstorageitem)
- [Generic file transfer best practices](https://docs.jfrog.com/artifactory/docs/generic-files)
- [MIME type configuration](https://docs.jfrog.com/installation/docs/artifactory-configuration-descriptors)
- [HTML sandbox behavior](https://jfrog.com/help/r/artifactory-blocked-script-execution)
- [Self-hosted reverse proxy configuration](https://docs.jfrog.com/installation/docs/http-settings)
- [Jenkins Lockable Resources plugin](https://plugins.jenkins.io/lockable-resources/)
- [Jenkins credential binding](https://www.jenkins.io/doc/pipeline/steps/credentials-binding/)

## Related

- [Publish with Artifactory](../docs/deploy/artifactory.md)
- [Testing](testing.md)
