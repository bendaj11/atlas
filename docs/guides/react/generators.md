---
title: React generators
description: Generate React Hosts, React Apps, and React Widgets with the Atlas CLI, and learn which options and versions they support.
---

# React generators

The `npx atlas g` command (short for `generate`) creates React Hosts, Apps, and Widgets as
normal Vite and React projects with Atlas configuration added. This page lists the commands,
their main options, and the files they create. For every option, see the
[CLI reference](../../reference/cli.md).

Run the commands on this page from the workspace root.

## Generate a host

```sh
npx atlas g host customer-host --framework react
```

The generator creates `package.json`, `tsconfig.json`, `vite.config.ts`, `atlas.config.ts`
with a new Host ID, `atlas.bootstrap.html`, `index.html`, and these source files:

| File                  | Purpose                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `src/bootstrap.tsx`   | Exports `mount` from `defineReactHost({ config, layout, reactDom, providers, useSdkOptions })`. |
| `src/host-layout.tsx` | `HostLayout` with the default host anchors.                                                     |
| `src/host.config.tsx` | `CustomerHostSdk`, `HostProviders`, and `useCustomHostSdkOptions()`.                            |
| `src/main.tsx`        | Stub for the Vite page.                                                                         |
| `src/styles.css`      | Global Host styles.                                                                             |

[Build a React host](host.md#1-generate-the-host) explains each file.

## Generate an app

```sh
npx atlas g app orders --framework react --host-id <host-id>
```

Replace `<host-id>` with the `id` from the Host's `atlas.config.ts`. With `--host-id`, the
App starts with a `/orders` route in that Host. Without it, the App has no routes until you
add them.

The generator creates `package.json`, `tsconfig.json`, `vite.config.ts`, `atlas.config.ts`
with a new App ID, `index.html`, and these source files:

| File                             | Purpose                                                  | Created when |
| -------------------------------- | -------------------------------------------------------- | ------------ |
| `src/bootstrap.tsx`              | App lifecycle from `createRoutedApp()` or `defineApp()`. | Always       |
| `src/App.tsx`                    | Root component.                                          | Always       |
| `src/index.css`                  | App styles (empty).                                      | Always       |
| `src/exported-widgets/README.md` | Explains how to add Widgets.                             | Always       |
| `src/routes.tsx`                 | Inner routes: an index route and `details/:id`.          | With routing |
| `src/home/Home.tsx`              | Sample index screen.                                     | With routing |
| `src/details/Details.tsx`        | Sample details screen.                                   | With routing |

In an interactive terminal the CLI asks whether to add inner routing. Pass `--routing` or
`--no-routing` to decide up front. Non-interactive runs create a routed App.

## Generate a widget

```sh
npx atlas g widget order-summary --app-id <app-id>
```

Replace `<app-id>` with the `id` from the owning App's `atlas.config.ts`. If you omit
`--app-id`, the CLI asks you to pick one of the configured Apps. The generator creates:

- `src/exported-widgets/order-summary/atlas.config.ts` with a new Widget ID and a name;
- `src/exported-widgets/order-summary/index.tsx` with a default-exported component.

Consumers render the Widget with `sdk.getWidget('<widget-id>')`. The folder name is internal.
Pass `--force` to replace an existing Widget with the same name. See
[Use widgets](sdk.md#use-widgets).

## Common options

| Option                        | Applies to | Effect                                                                          |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `--framework react`           | Host, App  | Selects React. In an interactive terminal the CLI asks when you omit it.        |
| `--framework-version <range>` | Host, App  | React version for new packages. Existing Nx packages keep their React version.  |
| `--port <number>`             | Host, App  | Dev-server port. Defaults to the next free port from 4200 (Host) or 4201 (App). |
| `--directory <path>`          | Host, App  | Target directory.                                                               |
| `--skip-install`              | Host, App  | Writes files without installing dependencies.                                   |
| `--skip-format`               | Host, App  | Skips formatting the generated files.                                           |
| `--force`                     | All        | Writes into an existing directory, or replaces an existing Widget.              |

## Workspaces

In an Nx workspace, Atlas first runs `@nx/react:application` to create the project, then adds
its own files. Pass `--skip-workspace-generator` to skip the Nx generator. In Turborepo,
pnpm, Yarn, npm, or standalone projects, Atlas creates a package that the workspace discovers
normally.

Read [Workspaces and monorepos](../workspaces-and-ci.md) before generating inside a large
repository.

## Framework versions

Atlas generates React 19 by default and supports React 17, 18, and 19. React 18 and 19
projects use React Router 7; React 17 projects use React Router 6. Generating any other
major version requires `--allow-unsupported-version`.

The generated `vite.config.ts` calls `@vitejs/plugin-react` as `react({})`. React Compiler
setup is up to your project.

## Next steps

- [React project structure](project-structure.md) for what each generated file does.
- [CLI reference](../../reference/cli.md) for every generator option.
