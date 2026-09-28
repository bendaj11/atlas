---
title: Generate an App
description: Create an Angular or React App with npx atlas generate app, connect it to a Host, and learn every option and generated file.
---

# Generate an App

This page shows how to create an App with `npx atlas generate app` (short form:
`npx atlas g app`), how to connect it to a Host, and which files Atlas creates.
Use it when you start a new feature. If you have never used Atlas, follow the
[Tutorial](tutorial.md) first.

## Generate an App

1. Find the host ID of the Host the App should appear in. It is the `id` value
   in the Host's `atlas.config.ts`:

   ```ts
   export default {
     type: 'host',
     id: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
     name: 'Customer Host',
     framework: 'react',
   } satisfies AtlasHostConfig;
   ```

2. From the [workspace](../introduction/glossary.md#workspace) root, run the
   following command with your own host ID:

   ```sh
   npx atlas g app orders --framework=react --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506
   ```

   Use `--framework=angular` for an Angular App. The App's framework does not
   need to match the Host's.

> **Expected result:** Atlas installs dependencies and ends with a line similar
> to `✓ Created "orders" at /path/to/workspace/apps/orders.` The App's
> `atlas.config.ts` contains a route for your Host:
>
> ```ts
> routes: [
>   {
>     hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
>     path: '/orders',
>     title: 'Orders',
>     nav: { label: 'Orders', visible: true },
>   },
> ];
> ```

3. Add the Host page to open during local development to the App's
   `package.json`:

   ```json
   {
     "atlas": {
       "previews": ["http://localhost:4200"]
     }
   }
   ```

   `npx atlas dev <app>` fails with
   `package.json atlas.previews is required for atlas dev apps.` until you add
   at least one URL. See [Local development](../guides/local-development.md#configure-previews).

> **Note:** When you run the command in an interactive terminal and omit an
> option, Atlas asks for it: the name, the framework, whether to add inner
> routing, and for Angular the stylesheet format. In a non-interactive run,
> such as CI, Atlas does not prompt. It uses `react` as the framework, creates
> inner routes, and uses `css` for Angular styles. Pass `--framework`
> explicitly in scripts.

> **Warning:** `--host-id` is the UUID from the Host's `atlas.config.ts`, not
> the Host's project name or URL. If you omit it, the App has no route and does
> not appear in any Host until you add one to `routes` or `slots`.

## Common tasks

### Generate an App without inner routes

```sh
npx atlas g app orders --framework=react --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506 --no-routing
```

Atlas creates a single component instead of a home page and a details page.

### Generate an Angular App with SCSS

```sh
npx atlas g app orders --framework=angular --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506 --style=scss
```

### Generate into a specific folder

```sh
npx atlas g app billing --framework=react --directory=apps/billing
```

> **Note:** Put `--routing` last on the command line or write it as
> `--routing=true`. Atlas reads the token after `--routing` as its value.

## Options

Syntax:

```text
npx atlas generate app <name-or-path> [options]
```

| Option                        | Values                        | Description                                                                                     | Default                                                                                 |
| ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `<name-or-path>`              | string                        | App name, or a path relative to the current directory.                                          | Prompted in an interactive terminal.                                                    |
| `--framework <name>`          | `angular`, `react`            | Framework of the generated App.                                                                 | Prompted in an interactive terminal; otherwise `react`.                                 |
| `--host-id <host-id>`         | UUID                          | Host ID for the generated route at `/<name>`.                                                   | No route.                                                                               |
| `--routing`, `--no-routing`   | flag                          | Create sample inner routes, or a single-component App.                                          | Prompted in an interactive terminal; otherwise routed.                                  |
| `--style <format>`            | `css`, `scss`, `sass`, `less` | Angular stylesheet format. Ignored for React.                                                   | Prompted in an interactive terminal; otherwise `css`.                                   |
| `--port <number>`             | number                        | Port of the App's dev server.                                                                   | Next unused port from `4201`.                                                           |
| `--framework-version <range>` | semver range                  | Framework version for a new project. In Nx, Atlas keeps the version the workspace already uses. | The Atlas default for the framework.                                                    |
| `--directory <path>`          | path                          | Directory to generate into.                                                                     | `apps/<name>`; see [Generate a Host](generate-host.md#where-atlas-creates-the-project). |
| `--allow-unsupported-version` | flag                          | Allow a framework version outside the range Atlas is tested with.                               | Off.                                                                                    |
| `--force`                     | flag                          | Write into an existing directory.                                                               | Off.                                                                                    |
| `--skip-install`              | flag                          | Create files without installing dependencies.                                                   | Off.                                                                                    |
| `--skip-workspace-generator`  | flag                          | In Nx, skip the Nx generator and let Atlas create the files directly.                           | Off.                                                                                    |
| `--yes`                       | flag                          | Approve installing a missing Nx plugin without asking.                                          | Off.                                                                                    |
| `-h`, `--help`                | flag                          | Print help for this command.                                                                    |                                                                                         |

Apps follow the same location rules as Hosts, except that Atlas uses the
`apps/*` workspace pattern. The [CLI reference](../reference/cli.md) lists
every command.

## Generated files

In a standalone project or package-manager workspace, a routed React App
contains:

| File                                                            | Purpose                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `atlas.config.ts`                                               | App ID, name, framework, and the `routes` and `slots` where the App appears.                                                                      |
| `src/bootstrap.tsx`                                             | The App's lifecycle entry. It calls `createRoutedApp` (or `defineApp` without routing) from `@atlas/sdk/react`.                                   |
| `src/App.tsx`                                                   | The App's root component.                                                                                                                         |
| `src/routes.tsx`                                                | Inner routes for React Router.                                                                                                                    |
| `src/home/Home.tsx`, `src/details/Details.tsx`                  | Sample pages. Created only with routing.                                                                                                          |
| `src/exported-widgets/README.md`                                | Where to put widgets this App exports.                                                                                                            |
| `src/index.css`                                                 | App styles.                                                                                                                                       |
| `index.html`, `vite.config.ts`, `tsconfig.json`, `package.json` | Vite and TypeScript setup. `package.json` contains the `dev`, `build`, `atlas:config`, and `atlas:publish` scripts and the `atlas.previews` list. |

An Angular App contains `atlas.config.ts`, `angular.json`,
`federation.config.mjs` (`federation.config.js` for older Angular versions),
`src/entry.ts` (the lifecycle entry that calls `defineApp` from
`@atlas/sdk/angular`), `src/main.ts`, `src/app/app.component.ts`,
`src/app/app.config.ts`, and, with routing, `src/app/app.routes.ts` and the
`home` and `details` components.

Edit the feature UI, styles, tests, and `atlas.config.ts`. Do not import Host
source code; use the [SDK](../reference/sdk.md) for Host services.

## Next steps

- [React App guide](../guides/react/app.md) or
  [Angular App guide](../guides/angular/app.md): build screens and use the SDK.
- [Local development](../guides/local-development.md): run the App inside a
  Host.
- [Apps](../concepts/apps.md): what an App owns.
