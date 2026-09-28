---
title: Generate an App
description: Create an Angular or React App with npx atlas generate app, connect it to a Host, and check the result.
---

# Generate an App

This page shows how to create an App with `npx atlas generate app` (short form: `npx atlas g app`) and connect it to a Host. Use it when you start a new feature. If you have never used Atlas, follow the [Tutorial](tutorial.md) first.

Every option is listed in the [CLI reference](../reference/cli.md#generate-host-and-generate-app). The files Atlas creates are described in [React project structure](../guides/react/project-structure.md) and [Angular project structure](../guides/angular/project-structure.md).

## Before you begin

Find the [Host ID](../introduction/glossary.md#host-id) of the Host the App should appear in. It is the `id` value in the Host's `atlas.config.ts`:

```ts
export default {
  type: 'host',
  id: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
  name: 'Customer Host',
  framework: 'react',
} satisfies AtlasHostConfig;
```

The commands on this page use that UUID. Replace it with your Host ID from `atlas.config.ts`.

> **Warning:** `--host-id` is the UUID from the Host's `atlas.config.ts`, not the Host's project name or URL. If you omit it, the App has no route and does not appear in any Host until you add one to `routes` or `slots`.

## Generate a React App for a Host

1. From the [workspace](../introduction/glossary.md#workspace) root, run:

   ```sh
   npx atlas g app orders --framework react --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506
   ```

   In an interactive terminal, Atlas asks `Add Atlas inner routing to this app?` and `Which port would you like to use for the dev server?`. The suggested port is the first port from 4201 that no other project in the workspace uses; press Enter to accept it. Pass `--routing true` and `--port 4201` to skip both questions.

   > **Expected result:** Atlas installs dependencies and ends with a line similar to `✓ Created "orders" at /path/to/workspace/apps/orders.` The App's `atlas.config.ts` contains a route for your Host:
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

2. Add the Host page to open during local development to the App's `package.json`:

   ```json
   {
     "atlas": {
       "previews": ["http://localhost:4200"]
     }
   }
   ```

   Until you add at least one URL, `npx atlas dev orders` fails with `package.json atlas.previews is required for atlas dev apps.` See [Local development](../guides/local-development.md#configure-previews).

> **Expected result:** With the Host running in another terminal (`npx atlas dev customer-host`), `npx atlas dev orders` opens `http://localhost:4200/orders` and shows the App inside the Host.

## Generate an Angular App

```sh
npx atlas g app orders --framework angular --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506 --style scss
```

Without `--style`, Atlas also asks `Which stylesheet format would you like to use?`. The App's framework does not need to match the Host's.

> **Expected result:** The same `✓ Created "orders"` line. The App's lifecycle entry is `src/entry.ts`.

## Generate an App without inner routes

```sh
npx atlas g app orders --framework react --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506 --no-routing
```

> **Expected result:** Atlas creates a single component instead of a home page and a details page.

`--routing` expects a value. Write `--routing true`, `--routing false`, or `--no-routing`; a bare `--routing` followed by another flag fails.

## Generate in CI or a script

In a non-interactive run, such as CI or with `--no-input`, Atlas never prompts. It uses `react` as the framework, creates inner routes, uses `css` for Angular styles, and takes the suggested port. Pass every value explicitly:

```sh
npx atlas g app orders --framework react --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506 --routing true --port 4201 --no-input
```

## Generate into a specific folder

Apps follow the same location rules as Hosts, except that Atlas uses the `apps/*` workspace pattern; see [Choose where the project goes](generate-host.md#choose-where-the-project-goes). To choose the folder yourself, pass `--directory`:

```sh
npx atlas g app billing --framework react --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506 --directory apps/billing
```

## Next steps

- [Build a React App](../guides/react/app.md) or [Build an Angular App](../guides/angular/app.md): build screens and use the SDK.
- [Local development](../guides/local-development.md): run the App inside a Host.
- [Apps](../concepts/apps.md): what an App owns.
