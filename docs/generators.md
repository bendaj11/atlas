# Generators

Generators make Atlas transparent for application teams.

Atlas detects Nx, Turborepo, package-manager workspaces, and standalone projects. Nx generation also creates `project.json` targets automatically. See [Workspaces and monorepos](workspaces.md).

## Interactive Use

Flags are optional in a terminal. Atlas asks only for missing information:

```sh
atlas g
atlas g app
atlas build
```

Use the arrow keys and Enter to choose the project type and framework; text prompts collect project names. Fully specified commands never prompt, and non-interactive environments such as CI retain deterministic command behavior.

The project argument may be a name or a relative path. In Nx, Atlas resolves it
from the directory where the command is run, matching the Nx CLI instead of
assuming an `apps/` layout. The final path segment becomes the project and Atlas
ID:

```sh
atlas g host apps/my-app --framework=angular
atlas g app products/orders --framework=react
```

For example, running `atlas g host my-app` from `<workspace>/products` creates
`<workspace>/products/my-app`.

After creating a host or MF, Atlas runs the detected Yarn, pnpm, or npm install command and waits for it to finish. In Nx, installation runs at the workspace root because Nx projects share the root dependency graph and do not require project-local `package.json` or `node_modules`. Other project types install from the generated project. Advanced automation that installs dependencies separately can pass `--skip-install`.

Before writing files, Atlas reports the detected workspace, selected framework,
target path, and whether scaffolding is delegated to a native Nx generator or
performed directly by Atlas.

If scaffolding, file generation, or dependency installation fails, Atlas removes a newly created project directory. Existing directories updated with `--force` are preserved to avoid deleting user-owned files.

Inside Nx, Atlas delegates initial project creation to the installed
`@nx/angular` or `@nx/react` generator before adding Atlas files. This preserves
the complete Nx scaffold: project and package manifests, source files, public
assets, TypeScript configuration, lint/test setup, and workspace conventions.
Atlas then adds only its explicitly owned integration files, such as
`atlas.config.ts`, `tsconfig.atlas.json`, generated federation compatibility
shims, and host
runtime configuration. It does not apply its portable application template over
the Nx result. Turbo,
Yarn, pnpm, and npm provide task or workspace orchestration rather than framework
generators, so Atlas creates a regular package that those tools discover normally.
If an Nx framework plugin is missing, Atlas asks permission to run `nx add` for
the matching plugin. Pass `--yes` in non-interactive automation to approve this.

## Host

```sh
atlas g host shell --framework=react
```

Creates a host shell with:

- typed `atlas.config.ts`
- host SDK setup
- catalog loading
- route/slot rendering
- example host capability providers

## App

```sh
atlas g app catalog --framework=react
```

## Generate A Widget

```bash
atlas g widget entity-popup --app=catalog
```

Atlas reads the owning MF framework and creates the typed Angular or React entry under `src/exported-components/entity-popup`. Federation exposes, manifest metadata, and CDN locations remain generated details.

Creates an MF with:

- typed `atlas.config.ts`
- framework-native entry
- generated Atlas lifecycle wrapper
- route contribution
- example SDK usage

## React

React generation creates real Vite applications, not contract-only placeholders. Hosts receive React Router integration, catalog-driven Native Federation loading, route and slot outlets, lifecycle UI, and external runtime configuration. MFs emit `remoteEntry.json` with automatic exposes for `src/exported-components/<id>/index.tsx`.

React Compiler is enabled in host and MF Vite builds through `babel-plugin-react-compiler`. Atlas selects the compiler target and adds its runtime when needed. React 17 generation uses React Router 6 and the legacy `react-dom` root API; React 18 and 19 use concurrent roots and React Router 7.

## Developer-Owned Files

Developers usually edit:

- feature components
- framework-native styles and assets using relative references
- `atlas.config.ts` for display name, routes, host compatibility, and placements

See [Assets and Styles](assets-and-styles.md) for Angular, React, Nx, and CDN
examples.

They should not edit generated federation wiring unless they are doing platform work. In Angular projects, `federation.config.js` is present because the Native Federation Angular builder requires that filename. Atlas generates it from Atlas conventions and owns it as compatibility plumbing; `atlas.config.ts` is the user-facing configuration file.

## Angular

```sh
atlas g host shell --framework=angular
atlas g app orders --framework=angular
```

Use `--directory=<path>` outside the Atlas monorepo. Generators refuse to overwrite an existing directory unless `--force` is explicit.

Angular generation includes:

- Angular CLI application and strict TypeScript configuration
- `@angular-architects/native-federation` builders
- generated `federation.config.js` compatibility shim with Atlas-controlled dependency isolation
- Native Federation's required `es-module-shims` bootstrap
- two-stage `main.ts` and `bootstrap.ts` initialization
- catalog-driven dynamic remote initialization
- external `public/atlas.runtime.json` production configuration
- catalog-driven route and slot lifecycle with loading/error state attributes
- standalone Angular components and deterministic teardown
- `injectAtlasSdk()` and generated `provideAtlasSdk()` wiring
- automatic exposes for `src/exported-components/<id>/index.ts`

Generated projects target Angular `^20.3.0` by default.

Product developers normally edit feature components and `atlas.config.ts`. Platform wiring, remote names, manifests, CDN paths, import maps, route teardown, and host SDK injection are generated or owned by `@atlas/sdk`.

Angular projects still contain a root `federation.config.js` because the Native Federation Angular builder resolves that exact filename beside the Angular tsconfig. Atlas treats it as a generated compatibility file, not a second product-facing config: edit `atlas.config.ts` and application source, and let Atlas own the federation shim.

## Framework Versions

Atlas does not force every microfrontend to use the same framework version:

```sh
atlas g app orders --framework=angular --framework-version=^21.2.0
atlas g app catalog --framework=react --framework-version=^18.3.0
```

Atlas accepts version profiles for Angular 19-22 and React 17-19. "Accepted" means the generator emits aligned framework packages, build tooling, type packages, Native Federation, Router APIs, and React Compiler settings for that major; it does not mean every profile is release-certified. React 17 and 18 receive `react-compiler-runtime` automatically.

The certified matrix is narrower: repository CI installs and production-builds the default Angular 20 and React 19 generated projects. Treat the other accepted majors as supported generation profiles that must pass your own generated-project CI before adoption.

Use `--allow-unsupported-version` deliberately for a future or unverified major, then require that combination to pass your generated-project CI before adoption. Vue remains a future target and is excluded from generation until its complete runtime and E2E path exists.
