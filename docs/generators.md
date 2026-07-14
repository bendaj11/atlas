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

Host generation creates one framework client project. `atlas build-bootstrap`
later emits static deployment files under its `dist/bootstrap`. No backend,
infrastructure, or pipeline project is emitted. Product teams usually edit framework source, styles, tests, and
`atlas.config.ts`. Atlas owns generated federation wiring, remote expose names,
manifest paths, and local override plumbing.
