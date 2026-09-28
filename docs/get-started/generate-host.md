---
title: Generate a Host
description: Create an Angular or React Host with npx atlas generate host, and learn every option and generated file.
---

# Generate a Host

This page shows how to create a Host with `npx atlas generate host` (short
form: `npx atlas g host`), where Atlas puts it, and which files it creates. Use
it when you start a new Host or add one to an existing repository. If you have
never used Atlas, follow the [Tutorial](tutorial.md) first.

## Generate a Host

1. Install the CLI in your [workspace](../introduction/glossary.md#workspace)
   root if you have not already:

   ```sh
   npm install --save-dev --save-exact @atlas/cli
   ```

2. From the workspace root, run:

   ```sh
   npx atlas g host customer-host --framework=react
   ```

   Use `--framework=angular` for an Angular Host.

> **Expected result:** Atlas prints where it generates the project, installs
> dependencies, and ends with a line similar to
> `✓ Created "customer-host" at /path/to/workspace/apps/customer-host.`
> The new `atlas.config.ts` contains a generated host ID (a UUID).

> **Note:** When you run the command in an interactive terminal and omit an
> option, Atlas asks for it: the name, the framework, and for Angular the
> stylesheet format. In a non-interactive run, such as CI, Atlas does not
> prompt. It uses `react` as the framework and `css` as the Angular stylesheet
> format. Pass `--framework` explicitly in scripts.

## Where Atlas creates the project

| Workspace kind                          | Default location                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Standalone project                      | `apps/<name>` under the workspace root.                                                                                       |
| npm, pnpm, or Yarn workspace, Turborepo | The folder matched by a `hosts/*` workspace pattern if you have one, otherwise the `apps/*` pattern, otherwise `apps/<name>`. |
| Nx                                      | `<current directory>/<name>`. Atlas runs the Nx generator (`@nx/react:application` or `@nx/angular:application`) first.       |

These rules also apply:

- If you run the command from a folder directly below the workspace root, such
  as `hosts/`, Atlas creates the project there.
- If you pass a path such as `platform/customer-host`, Atlas creates the project
  at that path relative to the current directory.
- `--directory=<path>` always wins.

## Common tasks

### Generate an Angular Host with SCSS

```sh
npx atlas g host customer-host --framework=angular --style=scss
```

### Generate into a specific folder

```sh
npx atlas g host customer-host --framework=react --directory=hosts/customer-host
```

### Generate without installing dependencies

```sh
npx atlas g host customer-host --framework=react --skip-install
```

Run your package manager's install command afterwards.

> **Warning:** `--force` lets Atlas write into an existing directory and
> overwrite files with the same names. Commit or back up the directory first.

## Options

Syntax:

```text
npx atlas generate host <name-or-path> [options]
```

| Option                        | Values                        | Description                                                                                     | Default                                                                  |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `<name-or-path>`              | string                        | Host name, or a path relative to the current directory.                                         | Prompted in an interactive terminal.                                     |
| `--framework <name>`          | `angular`, `react`            | Framework of the generated Host.                                                                | Prompted in an interactive terminal; otherwise `react`.                  |
| `--style <format>`            | `css`, `scss`, `sass`, `less` | Angular stylesheet format. Ignored for React.                                                   | Prompted in an interactive terminal; otherwise `css`.                    |
| `--port <number>`             | number                        | Port of the local host page used by `npx atlas dev`.                                            | Next unused port from `4200`.                                            |
| `--framework-version <range>` | semver range                  | Framework version for a new project. In Nx, Atlas keeps the version the workspace already uses. | The Atlas default for the framework.                                     |
| `--directory <path>`          | path                          | Directory to generate into.                                                                     | See [Where Atlas creates the project](#where-atlas-creates-the-project). |
| `--allow-unsupported-version` | flag                          | Allow a framework version outside the range Atlas is tested with.                               | Off.                                                                     |
| `--force`                     | flag                          | Write into an existing directory.                                                               | Off.                                                                     |
| `--skip-install`              | flag                          | Create files without installing dependencies.                                                   | Off.                                                                     |
| `--skip-workspace-generator`  | flag                          | In Nx, skip the Nx generator and let Atlas create the files directly.                           | Off.                                                                     |
| `--yes`                       | flag                          | Approve installing a missing Nx plugin without asking.                                          | Off.                                                                     |
| `-h`, `--help`                | flag                          | Print help for this command.                                                                    |                                                                          |

The [CLI reference](../reference/cli.md) lists every command.

## Generated files

In a standalone project or package-manager workspace, a React Host contains:

| File                                                            | Purpose                                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`                                               | Host ID, name, and framework. Keep the `id` stable; Apps reference it.                                                                                                    |
| `atlas.bootstrap.html`                                          | Template for the bootstrap page that `npx atlas dev` and `npx atlas bootstrap` use.                                                                                       |
| `src/host-layout.tsx`                                           | Your page layout with the host anchors: `AtlasHostLayout`, `AtlasHostStatus`, `AtlasSlot`, `AtlasNavigation`, `AtlasRouteOutlet`.                                         |
| `src/host.config.tsx`                                           | Product providers and custom host SDK options.                                                                                                                            |
| `src/bootstrap.tsx`                                             | Calls `defineReactHost` and exports the Host's `mount` function.                                                                                                          |
| `src/main.tsx`                                                  | Placeholder entry that tells you to start the Host with `npx atlas dev`.                                                                                                  |
| `src/styles.css`                                                | Global Host styles.                                                                                                                                                       |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` | Vite and TypeScript setup. `package.json` contains the `dev`, `build`, `atlas:config`, `atlas:publish`, and `atlas:bootstrap` scripts and an empty `atlas.previews` list. |

An Angular Host contains `atlas.config.ts`, `atlas.bootstrap.html`,
`angular.json`, `federation.config.mjs` (`federation.config.js` for Angular
versions that use the older Native Federation configuration API),
`src/app/app.component.ts` (the layout with the host anchors),
`src/app/app.config.ts`, `src/app/host.config.ts`, `src/bootstrap.ts`,
`src/main.ts`, and `src/styles.<ext>`.

In Nx, the Nx generator creates the project and Atlas adds its files and
targets on top.

Atlas also adds `.atlas/` to the workspace `.gitignore`. That folder holds
files that Atlas generates during development and builds.

## Next steps

- [Generate an App](generate-app.md) that appears in this Host.
- [React Host guide](../guides/react/host.md) or
  [Angular Host guide](../guides/angular/host.md): build the layout and shared
  services.
- [Hosts](../concepts/hosts.md): what a Host owns.
