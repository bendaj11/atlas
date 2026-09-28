---
title: Generate a Host
description: Create an Angular or React Host with npx atlas generate host in the most common situations, and check the result.
---

# Generate a Host

This page shows how to create a Host with `npx atlas generate host` (short form: `npx atlas g host`) in the most common situations. Use it when you start a new Host or add one to an existing repository. If you have never used Atlas, follow the [Tutorial](tutorial.md) first.

Every option is listed in the [CLI reference](../reference/cli.md#generate-host-and-generate-app). The files Atlas creates are described in [React project structure](../guides/react/project-structure.md) and [Angular project structure](../guides/angular/project-structure.md).

## Before you begin

Install the CLI in your [workspace](../introduction/glossary.md#workspace) root. [Get the packages](../reference/compatibility.md#get-the-packages) explains where the `@atlas` packages come from.

```sh
npm install --save-dev --save-exact @atlas/cli
```

## Generate a React Host

From the workspace root, run:

```sh
npx atlas g host customer-host --framework react
```

In an interactive terminal, Atlas asks `Which port would you like to use for the dev server?`. Press Enter to accept the suggestion: the first port from 4200 that no other project in the workspace uses. This port is where `npx atlas dev` serves the local Host page. Pass `--port 4200` to skip the question.

> **Expected result:** Atlas prints where it generates the project, installs dependencies, and ends with a line similar to `✓ Created "customer-host" at /path/to/workspace/apps/customer-host.` The new `atlas.config.ts` contains a generated [Host ID](../introduction/glossary.md#host-id) (a UUID). Apps need this ID to appear in the Host.

## Generate an Angular Host

```sh
npx atlas g host customer-host --framework angular --style scss --port 4200
```

Without `--style`, Atlas asks `Which stylesheet format would you like to use?` and offers CSS, SCSS, Sass, and Less.

> **Expected result:** The same `✓ Created "customer-host"` line. The Host layout with its host anchors is in `src/app/app.component.ts`.

## Generate in CI or a script

In a non-interactive run, such as CI or with `--no-input`, Atlas never prompts. It uses `react` as the framework, `css` as the Angular stylesheet format, and the suggested port. Pass every value explicitly so the result does not depend on those defaults:

```sh
npx atlas g host customer-host --framework react --port 4200 --no-input
```

## Choose where the project goes

By default, Atlas picks the folder from the workspace kind:

- In a standalone project, Atlas creates `apps/<name>`.
- In an npm, pnpm, or Yarn workspace or in Turborepo, Atlas reads the workspace patterns. An App goes into the folder of the `apps/*` pattern, otherwise into the folder of the first pattern with a wildcard (for example, `packages/<name>` when the only pattern is `packages/*`), otherwise into `apps/<name>`. A Host goes into the folder of a `hosts/*` pattern if you have one, otherwise into the same folder an App would use.
- In Nx, Atlas runs the Nx application generator first and creates the project in `<current directory>/<name>`.
- If you run the command from a folder directly below the workspace root, such as `hosts/`, Atlas creates the project there.

To choose the folder yourself, pass `--directory`:

```sh
npx atlas g host customer-host --framework react --directory hosts/customer-host
```

> **Expected result:** The `✓ Created` line shows the folder you passed.

## Generate without installing dependencies

```sh
npx atlas g host customer-host --framework react --skip-install
```

Atlas writes the files and skips the install. Run your package manager's install command afterwards. You also need this option when you install the `@atlas` packages from source tarballs; see [Build from source](../reference/compatibility.md#build-from-source).

> **Warning:** `--force` lets Atlas write into an existing directory and overwrite files with the same names. Commit or back up the directory first.

## Next steps

- [Generate an App](generate-app.md) that appears in this Host.
- [Build a React Host](../guides/react/host.md) or [Build an Angular Host](../guides/angular/host.md): build the layout and shared services.
- [Hosts](../concepts/hosts.md): what a Host owns.
