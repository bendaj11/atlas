---
title: React generators
description: Generate React Hosts, React Apps, and React Widgets with the Atlas CLI, and learn which React versions they support.
---

# React generators

The `npx atlas g` command (short for `generate`) creates React Hosts, Apps, and Widgets as normal Vite and React projects with Atlas configuration added. This page shows the React commands, what the CLI asks, and which React versions Atlas supports. For every option, see the [CLI reference](../../reference/cli.md#generate-host-and-generate-app). For every generated file, see [React project structure](project-structure.md).

Run the commands on this page from the workspace root.

## Generate a Host

```sh
npx atlas g host customer-host --framework react
```

In an interactive terminal, the CLI asks "Which port would you like to use for the dev server?" Press Enter to accept the suggestion: `4200`, or the next port that no other project in the workspace uses. Pass `--port` to skip the question.

The generator writes a new Host ID to `atlas.config.ts`. See [Host files](project-structure.md#host-files) for what it creates, and [Build a React Host](host.md) for what to do next.

## Generate an App

Replace the example UUID with your Host ID from the Host's `atlas.config.ts`:

```sh
npx atlas g app orders --framework react --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506
```

With `--host-id`, the App starts with a `/orders` route in that Host. Without it, the App has no routes until you add them.

In an interactive terminal, the CLI asks two more questions:

- "Add Atlas inner routing to this app?" Pass `--routing true` or `--no-routing` to decide up front. Non-interactive runs create a routed App.
- "Which port would you like to use for the dev server?" Press Enter to accept the suggestion: `4201`, or the next port that no other project in the workspace uses. Pass `--port` to skip the question.

The generator writes a new App ID to `atlas.config.ts`. See [App files](project-structure.md#app-files) for what it creates, and [Build a React App](app.md) for what to do next.

## Generate a Widget

Replace the example UUID with the owning App's ID from its `atlas.config.ts`:

```sh
npx atlas g widget order-summary --app-id 2bea9c13-4899-4f93-9211-cd8c55e9c529
```

If you omit `--app-id`, the CLI asks you to pick one of the configured Apps. Pass `--force` to replace an existing Widget with the same name. See [Widget files](project-structure.md#widget-files) for what it creates, and [Export a Widget](sdk.md#export-a-widget) for how to share it.

## React options

The [CLI reference](../../reference/cli.md#generate-host-and-generate-app) lists every option. These notes apply to React projects:

- `--framework react` selects React. In an interactive terminal the CLI asks when you omit it; non-interactive runs default to React.
- `--framework-version <range>` sets the React version for new packages. In an existing Nx workspace, Atlas keeps the workspace's React version.
- `--style` applies only to Angular projects.

## Framework versions

Atlas generates React 19 by default and supports React 17, 18, and 19. React 18 and 19 projects use React Router 7; React 17 projects use React Router 6. Generating any other major version requires `--allow-unsupported-version`.

The generated `vite.config.ts` calls `@vitejs/plugin-react` as `react({})`. React Compiler setup is up to your project.

## Workspaces

In an Nx workspace, Atlas first runs `@nx/react:application` to create the project, then adds its own files. Pass `--skip-workspace-generator` to skip the Nx generator. In Turborepo, pnpm, Yarn, npm, or standalone projects, Atlas creates a package that the workspace discovers normally. The target folder depends on the [workspace](../../introduction/glossary.md#workspace) kind; in a standalone project it is `apps/<name>`.

Read [Workspaces and CI](../workspaces-and-ci.md) before generating inside a large repository.

## Next steps

- [React project structure](project-structure.md) for what each generated file does.
- [CLI reference](../../reference/cli.md) for every generator option.
- [React troubleshooting](troubleshooting.md) if generation or installation fails.
