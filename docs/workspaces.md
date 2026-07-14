# Workspaces And Monorepos

Audience: developers adding Atlas to existing repository. Run commands from
workspace root unless section says otherwise. First confirm root contains one of
files in detection table below.

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
atlas dev customer-host
atlas dev orders
atlas build orders
```

When the shell is already inside an Atlas host or app directory, the project
name is optional:

```sh
atlas dev
```

For `atlas dev <app>`, Atlas infers the host when the app config declares only
one host. For multiple hosts, interactive terminals ask which host to use; in
non-interactive shells, pass `--host` or set `ATLAS_HOST_ID` to stable host UUID.
`ATLAS_HOST_URL` accepts either exact host page URL or base URL. For base
URL, Atlas appends the route base path from `atlas.config.ts`; when several
routes match the selected host, interactive terminals ask which route to use.
Set it in the shell or in the app project's `.env.local` file:

```dotenv
ATLAS_HOST_ID=0a17281f-287b-4d89-a8ca-0ab0e577c506
ATLAS_HOST_URL=http://127.0.0.1:4300
```

Atlas loads the selected project's env files before workspace env files, regardless
of invocation directory. Shell environment variables override both. Flags override all env values.

Atlas finds a project by Nx project name, package name, unscoped package name, directory name, or explicit directory. An Atlas project is identified by `atlas.config.ts`.
Atlas also detects a workspace root from `package.json#workspaces` before a lockfile exists.

## Nx

In Nx, generated project names and paths are relative to the directory where
Atlas is invoked, matching `nx generate`; Atlas does not force an `apps/` layout.
Atlas first invokes the workspace's installed
`@nx/angular:application` or `@nx/react:application` generator, then adds the
Atlas-specific client files. Host generation also invokes
`@nx/node:application` for the sibling `<host>-server` project before replacing
its sample entry with Atlas' composition root. Nx therefore remains responsible
for project metadata, TypeScript references, and workspace registration for both
projects. Atlas does not emit a nested `angular.json` when the Nx Angular
generator succeeds. When a required Nx plugin is missing, interactive Atlas
asks permission to add the version matched by Nx. Non-interactive automation can
approve this with `--yes`.

In an interactive terminal, Atlas hands control to the native Nx generator for
supported framework choices such as stylesheets, test runners, and bundler.
Atlas always disables Angular SSR because Atlas currently supports client-side
rendering only. In CI or another non-interactive environment, Atlas disables Nx
prompts and supplies deterministic defaults instead.

Atlas invokes targets such as `orders:build`, `orders:dev`, `orders:serve`, and
`orders:atlas:config`, so Nx caching and affected-project workflows remain active.
Generated `atlas:config` targets declare `{projectRoot}/.atlas` as an output, so
Nx cache restores the compiled `atlas.config.js` needed by `atlas dev` and
`atlas build`. The target runs `atlas compile-config`, which reads the
framework-generated project tsconfig and writes `.atlas/atlas.config.js`; Atlas
does not generate a separate `tsconfig.atlas.json`.
When Atlas delegates to native Nx generators, it preserves their generated
project metadata and unrelated targets while adding or replacing the targets
required by Atlas. Client projects receive targets such as `dev`, `serve`, and
`atlas:config`; the sibling server receives independent `build` and `start`
targets. Generated projects can also be run with native Nx commands:

```sh
nx run customer-host
nx run customer-host:dev
nx run customer-host-server:build
nx run customer-host-server:start
nx run orders
nx run orders:dev
nx run orders:serve
nx run orders:atlas:config
```

Nx treats `nx run <project>` as `nx run <project>:<project>`. Atlas adds that
project-named target as a compatibility alias for `dev`, so the shorter command
starts the generated host or app. For app projects, `dev` runs Atlas local
development and `serve` is the lower-level framework dev server used by Atlas.

Use `--skip-workspace-generator` only in automation that deliberately needs the
portable Atlas template instead of native Nx scaffolding.

Dependency ownership follows the Nx layout. If the native Nx generator creates
a project-level `package.json`, Atlas merges its required dependencies there and
runs install from that project. If the generated project has no package
manifest, Atlas merges dependencies into the workspace-root `package.json` and
runs install at the root. Atlas does not create a project-local `package.json`
or `node_modules` for integrated Nx workspaces.

Atlas never uses its default framework version to upgrade an existing Nx package
manifest. When the owning manifest already declares `@angular/core` or `react`,
Atlas keeps that version and aligns only the companion dependencies it must add.
If the CLI also receives `--framework-version` with a different major, Atlas
prints a warning and ignores the flag for that delegated project. To use another
major, change the workspace framework version before generation, let the Nx
generator create a project-level package manifest with its own framework
version, or use `--skip-workspace-generator` for a portable Atlas-generated
package.

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

Generated Atlas packages include `build`, `dev`, and `atlas:config` scripts.
When integrating Atlas into an existing package, expose those scripts and include
them in the Turbo task graph where appropriate.

Atlas starts generated hosts with the same top-level command used everywhere:

```sh
atlas dev customer-host
```

Under the hood, Atlas uses the same filter syntax as other Turbo tasks:

```sh
turbo run dev --filter=customer-host
pnpm exec turbo run dev --filter=customer-host
yarn exec -- turbo run dev --filter=customer-host
```

pnpm, Yarn, npm, and Turbo still require a task name in their native syntax, so
their direct commands use `run dev`. Use plain `atlas dev` from inside a
generated package when you want the shortest workspace-agnostic command.

## Package-Manager Workspaces

Atlas uses native workspace commands:

- Yarn: `yarn workspace <package> run <task>`
- pnpm: `pnpm --filter <package> run <task>`
- npm: `npm run <task> --workspace <package>`

No global Nx or Turbo installation is required. Atlas uses the workspace-local tool through the selected package manager.

Generated Atlas packages include the scripts Atlas needs. Start a generated host
with the same top-level command used everywhere:

```sh
atlas dev customer-host
```

Under the hood, Atlas uses the package manager command for your workspace:

```sh
pnpm --filter customer-host run dev
yarn workspace customer-host run dev
npm run dev --workspace customer-host
```

## Styles And Assets

Atlas does not replace a framework's style configuration. Nx or Angular may list
global styles and assets in `project.json` or `angular.json`; Vite may discover
them through imports. Atlas runs the workspace's normal production target and
then describes the emitted CSS in the app manifest. The host therefore loads the
same build output regardless of whether the source lives in Nx, Turbo, a Yarn
workspace, or a standalone project.

## Troubleshooting

Run Atlas from inside the monorepo. If two projects share a name, pass the project directory explicitly. Keep generated script and target names unchanged unless the workspace target delegates to them.
