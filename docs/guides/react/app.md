---
title: Build a React app
description: Generate a React App, choose where it appears in a Host, build its screens, and run it inside the Host locally.
---

# Build a React app

This guide shows you how to build a React [App](../../introduction/glossary.md): a feature
that a team develops and releases on its own and that appears inside a Host at a URL or in a
named slot. It is for feature teams that already have a Host to run in.

## Before you start

You need:

- Node.js `^22.12.0` or `^24.0.0`, and a workspace with `@atlas/cli` installed. The
  [tutorial](../../get-started/tutorial.md) shows how to set one up.
- A Host to run the App in. It can be a React Host from [Build a React host](host.md) or an
  Angular Host; Apps and Hosts do not need to use the same framework.
- The Host ID. Open the Host project's `atlas.config.ts` and copy the value of `id`. It is a
  UUID such as `0a17281f-287b-4d89-a8ca-0ab0e577c506`. If the Host belongs to another team,
  ask that team for it.

Run every command in this guide from the workspace root.

## 1. Generate the app

Generate an App named `orders`. Replace `<host-id>` with the Host ID you copied:

```sh
npx atlas g app orders --framework react --host-id <host-id>
```

`--host-id` adds an initial `/orders` route in that Host. Without it, the App has no routes
until you add them. In an interactive terminal the CLI asks whether to add inner routing;
pass `--routing` or `--no-routing` to skip the question. Non-interactive runs default to
routing.

With routing, the generator creates this project:

```text
orders/
  package.json
  tsconfig.json
  vite.config.ts
  atlas.config.ts
  index.html
  src/
    App.tsx
    bootstrap.tsx
    index.css
    routes.tsx
    home/Home.tsx
    details/Details.tsx
    exported-widgets/README.md
```

With `--no-routing`, the generator omits `routes.tsx`, `home/`, and `details/`, and `App.tsx`
is a single page.

| File                        | What it does                                                                               | Edit it?                                           |
| --------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `atlas.config.ts`           | App ID, name, framework, routes, and slots.                                                | Yes, when the App's placement changes.             |
| `src/App.tsx`               | Root component. With routing, it renders links and an `<Outlet />`.                        | Yes.                                               |
| `src/routes.tsx`            | Inner React Router routes, relative to the App's path.                                     | Yes.                                               |
| `src/home/`, `src/details/` | Sample screens for the index route and the `details/:id` route.                            | Yes. Replace them with your screens.               |
| `src/bootstrap.tsx`         | The App lifecycle that Atlas mounts and unmounts.                                          | Rarely.                                            |
| `src/exported-widgets/`     | Components this App shares with other Apps and Hosts as Widgets.                           | When you add a Widget.                             |
| `package.json`              | Scripts, dependencies, and `atlas.previews` for local development.                         | Yes, to set previews.                              |
| `vite.config.ts`            | Vite configuration composed with `createReactAppViteConfig`, which adds Native Federation. | Yes, but keep the `createReactAppViteConfig` call. |

> **Expected result:** An `orders/` folder exists, and `orders/atlas.config.ts` contains a
> route whose `hostId` is your Host ID.

## 2. Choose where the app appears

An App declares its own placement in `atlas.config.ts`. The Host does not list its Apps.
The generated file looks like this, with your own App ID and Host ID:

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
- `nav` controls the link that the Host's navigation shows. Add `order` to sort links, or set
  `visible: false` to hide the link while keeping the route.

Keep the generated App `id` when you rename the App. See [React routing](routing.md) for
every route field, route conflicts, and layouts.

## 3. Build the feature UI

Build your screens with normal React components, hooks, and React Router:

- Add routes in `src/routes.tsx`. Paths are relative to the App's `path`, so `details/:id`
  appears in the browser as `/orders/details/42`.
- Replace `src/home/Home.tsx` and `src/details/Details.tsx` with your screens.
- Read Host services with `useAtlasSdk()` from `@atlas/sdk/react`. See [React SDK](sdk.md).
- Import images and CSS relative to the file that uses them. See
  [React assets and styles](assets-and-styles.md).

Do not import Host source code. If you need something from the Host, ask the Host team to
expose it through the SDK.

## 4. Run the app inside the host

`atlas dev` for an App needs to know which Host page to open. Set it in
`orders/package.json`. The generator creates an empty `atlas.previews` list; add the local
Host URL where Orders appears:

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

The second command prints an `App preview` URL and opens it. If `atlas.previews` is empty,
the command stops with `package.json atlas.previews is required for atlas dev apps.`

> **Expected result:** The Host page at `http://localhost:4200/orders` shows the Orders
> heading and its Home screen inside the route outlet. Clicking the Details link changes the
> browser URL to `/orders/details/42`, and refreshing that URL shows the same screen.

A preview can also point at a deployed Host. [Columbus](../columbus.md) and
[Local development](../local-development.md) explain how local Apps replace deployed
versions in a real page. If you list several previews, the CLI asks which one to open.

## 5. Test the app

Test your components with the Atlas test kit, which provides a mock SDK and App context.
See [React SDK](sdk.md#test-components-that-use-the-sdk) for a short example and
[Testing apps and hosts](../testing-apps-and-hosts.md) for the full guide.

Before you release, run the App inside the real Host once more to check routing, styles,
and SDK contracts together.

## Common mistakes

- Running `npx atlas dev orders` before setting `atlas.previews`.
- Copying a Host ID from an example instead of from your Host's `atlas.config.ts`.
- Using `createBrowserRouter` inside the App. Apps use a memory router; see
  [React routing](routing.md#define-inner-routes).
- Importing Host code instead of using the SDK.

## Next steps

- [React routing](routing.md) for route fields, slots, and cross-App navigation.
- [React SDK](sdk.md) for host data, events, Widgets, and readiness.
- [React production deployment](production-deployment.md) to build and publish the App.
