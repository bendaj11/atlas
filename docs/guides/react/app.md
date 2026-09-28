---
title: Build a React App
description: Generate a React App, choose where it appears in a Host, build its screens, and run it inside the Host locally.
---

# Build a React App

This guide shows you how to build a React [App](../../introduction/glossary.md#app): a feature that a team develops and releases on its own and that appears inside a Host at a URL or in a named slot. It is for feature teams that already have a Host to run in.

> **Note:** If you completed the tutorial, skip step 1 and open `apps/orders`.

## Before you start

You need:

- Node.js `^22.12.0` or `^24.0.0`, and a workspace with `@atlas/cli` installed. The [tutorial](../../get-started/tutorial.md) shows how to set one up.
- A Host to run the App in. It can be a React Host from [Build a React Host](host.md) or an Angular Host; Apps and Hosts do not need to use the same framework.
- The Host ID. Open the Host project's `atlas.config.ts` and copy the value of `id`. If the Host belongs to another team, ask that team for it.

Run every command in this guide from the workspace root. The examples use `apps/customer-host` and `apps/orders`, the folders Atlas uses in a standalone project. The folder depends on your [workspace](../../introduction/glossary.md#workspace) kind.

## 1. Generate the App

Generate an App named `orders`. Replace the example UUID with your Host ID from the Host's `atlas.config.ts`:

```sh
npx atlas g app orders --framework react --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506
```

`--host-id` adds an initial `/orders` route in that Host. Without it, the App has no routes until you add them.

In an interactive terminal, the CLI asks two more questions:

- "Add Atlas inner routing to this app?" Choose sample routes or a single-page App. Pass `--routing true` or `--no-routing` to skip the question. Non-interactive runs create a routed App.
- "Which port would you like to use for the dev server?" Press Enter to accept the suggestion: `4201`, or the next port that no other project in the workspace uses. Pass `--port` to skip the question.

The generator creates a Vite and React project. In this guide you edit `atlas.config.ts`, `package.json`, and the screens under `src/`. See [React project structure](project-structure.md#app-files) for every generated file.

> **Expected result:** An `apps/orders/` folder exists, and `apps/orders/atlas.config.ts` contains a route whose `hostId` is your Host ID.

## 2. Choose where the App appears

An App declares its own placement in `atlas.config.ts`. The Host does not list its Apps. The generated file looks like this, with your own App ID and Host ID:

```ts
import type { AtlasAppConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'app',
  id: '2bea9c13-4899-4f93-9211-cd8c55e9c529',
  name: 'Orders',
  framework: 'react',
  routes: [
    {
      hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
      path: '/orders',
      title: 'Orders',
      nav: { label: 'Orders', visible: true },
    },
  ],
} satisfies AtlasAppConfig;
```

- `routes` mount the App into the Host's route outlet when the URL starts with `path`.
- `slots` mount the App into a named `AtlasSlot`, such as `{ hostId, slotId: 'header' }`.
- `nav` controls the link that the Host's navigation shows.

Keep the generated App `id` when you rename the App. Every route and slot field is listed in the [configuration reference](../../reference/configuration.md#route-fields). See [React routing](routing.md) for layouts and route conflicts.

## 3. Build the feature UI

Build your screens with normal React components, hooks, and React Router:

- Add routes in `src/routes.tsx`. Paths are relative to the App's `path`, so `details/:id` appears in the browser as `/orders/details/42`.
- Replace `src/home/Home.tsx` and `src/details/Details.tsx` with your screens.
- Read Host services with `useAtlasSdk()` from `@atlas/sdk/react`. See [React SDK](sdk.md).
- Import images and CSS relative to the file that uses them. See [React assets and styles](assets-and-styles.md).

Do not import Host source code. If you need something from the Host, ask the Host team to expose it through the SDK.

## 4. Run the App inside the Host

`npx atlas dev` for an App needs to know which Host page to open. Set it in `apps/orders/package.json`. The generator creates an empty `atlas.previews` list; add the local Host URL where Orders appears:

```json
{
  "atlas": {
    "previews": ["http://localhost:4200/orders"]
  }
}
```

Then start the Host and the App in two terminals:

```sh
# Terminal 1, workspace root
npx atlas dev customer-host
```

```sh
# Terminal 2, workspace root
npx atlas dev orders
```

The second command prints an `App preview` URL and opens it. If `atlas.previews` is empty, the command stops with `package.json atlas.previews is required for atlas dev apps.`

> **Expected result:** The Host page at `http://localhost:4200/orders` shows the Orders heading and its Home screen inside the route outlet. Clicking the Details link changes the browser URL to `/orders/details/42`, and refreshing that URL shows the same screen.

If you list several previews, the CLI asks which one to open. A preview can also point at a deployed Host page. [Columbus](../columbus.md) and [Local development](../local-development.md) explain how a local App replaces the deployed version in a real page.

## 5. Test the App

Test your components with the Atlas test kit, which provides a mock SDK and App context. See [Test components that use the SDK](sdk.md#test-components-that-use-the-sdk) for a short example and [Testing Apps and Hosts](../testing-apps-and-hosts.md) for the full guide.

Before you release, run the App inside the real Host once more to check routing, styles, and SDK contracts together.

## Common mistakes

- Running `npx atlas dev orders` before setting `atlas.previews`.
- Copying a Host ID from an example instead of from your Host's `atlas.config.ts`.
- Using `createBrowserRouter` inside the App. Apps use a memory router; see [Define inner routes](routing.md#define-inner-routes).
- Importing Host code instead of using the SDK.

## Next steps

- [React routing](routing.md) for layouts, slots, and cross-App navigation.
- [React SDK](sdk.md) for host data, events, Widgets, and readiness.
- [React production deployment](production-deployment.md) to build and publish the App.
