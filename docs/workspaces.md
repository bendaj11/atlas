# Workspaces And Monorepos

## Developing Atlas Itself

The Atlas repository uses Yarn workspaces with Turborepo. The root commands are
the stable interface for contributors:

```sh
yarn build
yarn typecheck
yarn build:examples
```

Turbo derives package order from workspace dependencies and caches `dist`
outputs. Atlas consumers do not need Turborepo: generated projects also work in
Nx, Turborepo, Yarn workspaces, or standalone repositories through the workspace
discovery implemented by the CLI.

Atlas uses the same commands in Nx, Turborepo, package-manager workspaces, and standalone projects. There is no Atlas workspace setting to maintain.

## Automatic Detection

Atlas walks up from the current directory and selects the first matching workspace:

| File | Behavior |
| --- | --- |
| `nx.json` | Runs project targets through Nx |
| `turbo.json` | Runs package tasks through Turborepo filters |
| `package.json` with `workspaces` | Runs the selected package through Yarn, pnpm, or npm |
| `pnpm-workspace.yaml` | Runs the selected package through pnpm workspace filters |
| None | Runs scripts from the Atlas project's directory |

The package manager comes from `packageManager` in the root `package.json`, then the lockfile. Yarn, pnpm, and npm are supported.

The globally installed CLI is invoked identically in every workspace. Atlas
then uses the detected package manager internally, so developers do not prefix
Atlas commands with `yarn`, `pnpm`, or `npm exec`.

```sh
atlas dev orders --host=customer-shell
atlas build orders
```

Atlas finds a project by Nx project name, package name, unscoped package name, directory name, or explicit directory. An Atlas project is identified by `atlas.config.ts`.
Atlas also detects a workspace root from `package.json#workspaces` before a lockfile exists.

## Nx

In Nx, generated project names and paths are relative to the directory where
Atlas is invoked, matching `nx generate`; Atlas does not force an `apps/` layout.
Atlas first invokes the workspace's installed
`@nx/angular:application` or `@nx/react:application` generator, then adds the
Atlas-specific files. Nx therefore remains responsible for `project.json`,
linting, testing, TypeScript references, and workspace registration. Atlas does
not emit a nested `angular.json` when the Nx Angular generator succeeds. When
`@nx/angular` or `@nx/react` is missing, interactive Atlas asks permission
to add the version matched by Nx. Non-interactive automation can approve this
with `--yes`.

In an interactive terminal, Atlas hands control to the native Nx generator for
framework choices such as stylesheets, test runners, bundler, and SSR. In CI or
another non-interactive environment, Atlas disables Nx prompts and supplies
deterministic defaults instead.

Atlas invokes targets such as `orders:build`, `orders:dev`, and
`orders:atlas:config`, so Nx caching and affected-project workflows remain active.
Use `--skip-workspace-generator` only in automation that deliberately needs the
portable Atlas template instead of native Nx scaffolding.

Dependency ownership follows the Nx layout. If the native Nx generator creates
a project-level `package.json`, Atlas merges its required dependencies there and
runs install from that project. If the generated project has no package
manifest, Atlas merges dependencies into the workspace-root `package.json` and
runs install at the root. Atlas does not create a project-local `package.json`
or `node_modules` for integrated Nx workspaces.

When integrating Atlas into an existing Nx project, expose these three targets. Their commands remain the framework's normal build and development commands.
Atlas reads the build target's `options.outputPath`, configuration-specific
`outputPath` values, and declared `outputs`. It also recognizes the conventional
workspace output `dist/apps/<project>`, including Angular's `browser`
subdirectory. A candidate is accepted only when it contains `remoteEntry.json`.

## Turborepo

Generated projects go under `apps/`. Atlas invokes package scripts through `turbo run <task> --filter=<package>`, preserving the dependency graph and cache policy from `turbo.json`.

Turborepo does not provide framework application generators. Atlas creates a
normal package under the repository's declared workspace pattern (for example,
`apps/*` or `packages/*`) so Turbo discovers it without extra configuration.

Ensure `build`, `dev`, and `atlas:config` are declared in the package and included in the Turbo task graph where appropriate.

## Package-Manager Workspaces

Atlas uses native workspace commands:

- Yarn: `yarn workspace <package> run <task>`
- pnpm: `pnpm --filter <package> run <task>`
- npm: `npm run <task> --workspace <package>`

No global Nx or Turbo installation is required. Atlas uses the workspace-local tool through the selected package manager.

## Styles And Assets

Atlas does not replace a framework's style configuration. Nx or Angular may list
global styles and assets in `project.json` or `angular.json`; Vite may discover
them through imports. Atlas runs the workspace's normal production target and
then describes the emitted CSS in the MF manifest. The host therefore loads the
same build output regardless of whether the source lives in Nx, Turbo, a Yarn
workspace, or a standalone project.

## Troubleshooting

Run Atlas from inside the monorepo. If two projects share a name, pass the project directory explicitly. Keep generated script and target names unchanged unless the workspace target delegates to them.
