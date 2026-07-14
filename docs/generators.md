# Generators

Generator output is framework-specific. Pick the page for the framework you are
using:

- [Angular generators](angular/generators.md)
- [React generators](react/generators.md)

Shared commands:

```sh
atlas g
atlas g host customer-host --framework=angular
atlas g app orders --framework=angular
atlas g host customer-host --framework=react
atlas g app orders --framework=react
atlas g widget entity-popup --app=orders
```

Atlas detects Nx, Turborepo, package-manager workspaces, and standalone
projects. See [Workspaces and monorepos](workspaces.md) before generating in a
large repository.

Host generation creates framework client source plus editable
`server/main.mts`. Generated package scripts build client and server
independently; no infrastructure or pipeline files are emitted. Product teams
usually edit framework source, server composition, styles, tests, and
`atlas.config.ts`. Atlas owns generated federation wiring, remote expose names,
manifest paths, and local override plumbing.
