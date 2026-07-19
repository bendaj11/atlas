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

In an Nx workspace, `atlas g host` and `atlas g app` automatically add Atlas
targets and the `atlas` project tag to the generated project's `project.json`.
Existing project tags are preserved. No manual Nx target or tag setup is
required. This applies to projects created through the Atlas generator; running
`nx generate` directly does not add Atlas configuration or the `atlas` tag to
that project.

Host generation creates one framework client project plus user-owned
`atlas.bootstrap.html` for product-domain loading UI. `atlas build-bootstrap`
uses that template automatically and emits static deployment files under
`dist/bootstrap`. No backend, infrastructure, or pipeline project is emitted.
Product teams usually edit framework source, styles, tests,
`atlas.bootstrap.html`, and `atlas.config.ts`. Atlas owns generated federation
wiring, remote expose names, manifest paths, and local override plumbing.

Generated Atlas projects expose native workspace integration:

- `atlas:config`: compile Atlas configuration;
- `atlas:publish`: depend on framework build, then publish under storage lease;
- hosts: `atlas:bootstrap`: build deterministic static bootstrap.

Non-Atlas projects receive none of these targets. CI uses Nx, Turbo, Yarn, or
pnpm selection instead of listing Atlas projects. See [Workspace integration](workspaces.md).
