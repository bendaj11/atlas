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

After creating a host or MF, Atlas runs the detected Yarn, pnpm, or npm install command from the generated project and waits for it to finish. The package manager automatically coordinates with a parent Nx, Turbo, or package-manager workspace when applicable. Advanced automation that installs dependencies separately can pass `--skip-install`.

Inside Nx, Atlas delegates initial project creation to the installed
`@nx/angular` or `@nx/react` generator before adding Atlas files. This preserves
Nx project configuration, lint/test setup, and workspace conventions. Turbo,
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

They should not edit generated federation wiring unless they are doing platform work.

## Angular

```sh
atlas g host shell --framework=angular
atlas g app orders --framework=angular
```

Use `--directory=<path>` outside the Atlas monorepo. Generators refuse to overwrite an existing directory unless `--force` is explicit.

Angular generation includes:

- Angular CLI application and strict TypeScript configuration
- `@angular-architects/native-federation` builders
- generated `federation.config.js` with Atlas-controlled dependency isolation
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

## Framework Versions

Atlas does not force every microfrontend to use the same framework version:

```sh
atlas g app orders --framework=angular --framework-version=^21.2.0
atlas g app catalog --framework=react --framework-version=^18.3.0
```

Atlas accepts version profiles for Angular 19-22 and React 17-19. "Accepted" means the generator emits aligned framework packages, build tooling, type packages, Native Federation, Router APIs, and React Compiler settings for that major; it does not mean every profile is release-certified. React 17 and 18 receive `react-compiler-runtime` automatically.

The certified matrix is narrower: repository CI installs and production-builds the default Angular 20 and React 19 generated projects. Treat the other accepted majors as supported generation profiles that must pass your own generated-project CI before adoption.

Use `--allow-unsupported-version` deliberately for a future or unverified major, then require that combination to pass your generated-project CI before adoption. Vue remains a future target and is excluded from generation until its complete runtime and E2E path exists.
