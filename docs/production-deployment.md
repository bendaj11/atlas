# Production Deployment

Production deployment has shared registry mechanics, but host and app build
details are framework-specific. Pick the page for the framework you are using:

- [Angular production deployment](angular/production-deployment.md)
- [React production deployment](react/production-deployment.md)

Shared production model:

1. Host serves `atlas.runtime.json`.
2. Host runtime config points to one host catalog.
3. Catalog selects one manifest version for every app needed by that host.
4. Apps publish immutable assets and mutable JSON indexes.
5. CI verifies public files with `atlas verify`.
6. Rollback replaces mutable JSON; it does not rebuild apps or redeploy hosts.

For storage layout and concurrency rules, see [Static registry](registry.md).
For origin, integrity, and CSP rules, see [Security](security.md).
Before enabling traffic, complete [Production readiness](production-readiness.md).
