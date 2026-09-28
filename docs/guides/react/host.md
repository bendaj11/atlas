---
title: Build a React host
description: Generate a React Host, lay out the page with host anchors, provide shared services through the SDK, and run it locally.
---

# Build a React host

This guide walks you through building a React [Host](../../introduction/glossary.md): the
page layout, top-level navigation, and shared browser services that every App runs inside.
It is for the team that owns the product shell. If you have not run Atlas before, complete
the [tutorial](../../get-started/tutorial.md) first.

## Before you start

You need:

- Node.js `^22.12.0` or `^24.0.0`.
- A workspace with `@atlas/cli` installed as a dev dependency. The
  [tutorial](../../get-started/tutorial.md) shows how to create one.
- A basic understanding of how Hosts and Apps divide the page. Read
  [Hosts](../../concepts/hosts.md) and [Host anchors](../../concepts/host-anchors.md) if the
  terms are new.

Run every command in this guide from the workspace root unless a step says otherwise.

## 1. Generate the host

Generate a React Host named `customer-host`:

```sh
npx atlas g host customer-host --framework react
```

The generator creates this project:

```text
customer-host/
  package.json
  tsconfig.json
  vite.config.ts
  atlas.config.ts
  atlas.bootstrap.html
  index.html
  src/
    bootstrap.tsx
    host-layout.tsx
    host.config.tsx
    main.tsx
    styles.css
```

| File                   | What it does                                                                                          | Edit it?                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `atlas.config.ts`      | Declares the Host ID (a UUID), display name, and framework.                                           | Change the name. Never change the ID after Apps use it. |
| `src/host-layout.tsx`  | The `HostLayout` component: your page layout and the host anchors where Apps appear.                  | Yes. Most host UI work happens here.                    |
| `src/host.config.tsx`  | Your SDK type (`CustomerHostSdk`), product providers (`HostProviders`), and SDK options hook.         | Yes.                                                    |
| `src/bootstrap.tsx`    | Exports the `mount` function Atlas calls. It passes the files above to `defineReactHost()`.           | Rarely.                                                 |
| `src/main.tsx`         | A stub for the Vite page. It only prints a message telling you to use `atlas dev`.                    | No.                                                     |
| `atlas.bootstrap.html` | The HTML template that `atlas bootstrap` turns into the static entry page.                            | Yes, for the page title and loading markup.             |
| `vite.config.ts`       | Vite configuration composed with `createReactHostViteConfig`, which adds the Native Federation setup. | Yes, but keep the `createReactHostViteConfig` call.     |
| `src/styles.css`       | Global Host styles.                                                                                   | Yes.                                                    |

The generated `atlas.config.ts` looks like this. Your `id` is a different, randomly
generated UUID:

```ts
import type { AtlasHostConfig } from '@atlas/schema' with {
  'resolution-mode': 'import',
};

export default {
  type: 'host',
  id: '0a17281f-287b-4d89-a8ca-0ab0e577c506',
  name: 'Customer Host',
  framework: 'react',
} satisfies AtlasHostConfig;
```

Apps use this `id` to declare where they appear in your Host. Keep it unchanged when you
rename the folder, package, repository, or display name.

> **Expected result:** A `customer-host/` folder exists with the files listed above, and its
> `atlas.config.ts` contains a UUID `id`.

## 2. Understand how the host starts

The generated `src/bootstrap.tsx` connects your files to Atlas:

```tsx
import 'es-module-shims';
import { createRoot } from 'react-dom/client';
import { defineReactHost } from '@atlas/runtime/react';
import atlasConfig from '../atlas.config';
import { HostLayout } from './host-layout';
import {
  HostProviders,
  useCustomHostSdkOptions,
  type CustomerHostSdk,
} from './host.config';
import './styles.css';

export const mount = defineReactHost<CustomerHostSdk>({
  config: atlasConfig,
  layout: HostLayout,
  reactDom: { createRoot },
  providers: HostProviders,
  useSdkOptions: useCustomHostSdkOptions,
});
```

In a browser, the Atlas [loader](../../introduction/glossary.md) reads the
[runtime config](../../introduction/glossary.md) (`atlas.runtime.json`), resolves which Host
and App versions are deployed, and calls `mount` with a container element.
`defineReactHost()` then:

1. creates a React Router browser router with one catch-all route that renders `HostLayout`;
2. wraps the tree in `HostProviders`;
3. creates the Host's SDK from the options returned by `useCustomHostSdkOptions()`;
4. renders the tree into the container that the loader provided;
5. starts Atlas, which mounts the selected Apps into the host anchors in `HostLayout`;
6. returns an `unmount` function that the loader calls when it stops the Host.

You do not fetch the list of Apps or choose App versions in React code. The loader passes
that information to `mount`.

The Vite dev server serves only the `src/main.tsx` stub, so opening it directly shows the
message "Start this Atlas host with atlas dev." Always open the URL that `atlas dev` prints.

## 3. Build the host layout

Edit `src/host-layout.tsx`. The generated layout uses the React host anchors from
`@atlas/runtime/react`:

```tsx
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/react';

export function HostLayout() {
  return (
    <AtlasHostLayout layoutId="default">
      <AtlasHostStatus />
      <header>
        <strong>Atlas</strong>
        <AtlasSlot slotId="header" />
      </header>
      <AtlasNavigation aria-label="Application" />
      <AtlasRouteOutlet />
    </AtlasHostLayout>
  );
}
```

Replace the markup with your product layout and keep the anchors where Apps should appear:

```tsx
import {
  AtlasHostLayout,
  AtlasHostStatus,
  AtlasNavigation,
  AtlasRouteOutlet,
  AtlasSlot,
} from '@atlas/runtime/react';

export function HostLayout() {
  return (
    <AtlasHostLayout layoutId="default">
      <div className="product-shell">
        <AtlasHostStatus />

        <header className="product-header">
          <a href="/" className="product-brand">
            Customer Portal
          </a>
          <AtlasSlot slotId="header" />
        </header>

        <div className="product-workspace">
          <aside className="product-sidebar">
            <AtlasNavigation aria-label="Applications" />
            <AtlasSlot slotId="sidebar" />
          </aside>

          <main className="product-content">
            <AtlasRouteOutlet />
          </main>
        </div>
      </div>
    </AtlasHostLayout>
  );
}
```

Each anchor renders a custom element and registers it with Atlas:

| Anchor                                 | Renders                  | Purpose                                                                                        |
| -------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `<AtlasHostLayout layoutId="default">` | Its children, or nothing | Shows its children only while a route that uses this layout is active.                         |
| `<AtlasHostStatus />`                  | `<atlas-status>`         | Holds the Host loading and error UI while Atlas starts.                                        |
| `<AtlasNavigation aria-label="…" />`   | `<atlas-navigation>`     | Renders a basic list of links to routed Apps. Optional; omit it to render your own navigation. |
| `<AtlasRouteOutlet />`                 | `<atlas-route-outlet>`   | Where the App that matches the current URL mounts.                                             |
| `<AtlasSlot slotId="header" />`        | `<atlas-slot>`           | Where Apps that declare the `header` slot mount.                                               |

Keep these rules in mind:

- **Every route needs a layout.** Each App route activates a layout by `layoutId`. Routes
  that do not set `layoutId` use `"default"`, so keep one `AtlasHostLayout` with
  `layoutId="default"`. To give some routes a different page frame, see
  [Use more than one layout](routing.md#use-more-than-one-layout).
- **Slots follow the anchor.** Atlas mounts a slot App when a matching `AtlasSlot` is
  rendered and unmounts it when the anchor is removed. If no anchor exists for a slot, the
  App does not appear.
- **Use each slot name once.** Atlas tracks one element per slot name.
- **Anchors need the host provider.** Anchors must render inside the tree that
  `defineReactHost()` creates. Rendering one in a separate React root throws an error.

To render navigation with your own design system instead of `AtlasNavigation`, use
`useAtlasNavigationItems()`. See [Render custom navigation](routing.md#render-custom-navigation).

> **Expected result:** `HostLayout` compiles, and it still contains one `AtlasHostLayout`
> with `layoutId="default"`, one `AtlasHostStatus`, and one `AtlasRouteOutlet`.

## 4. Provide host services through the SDK

Apps never import Host source code. Instead, the Host exposes shared capabilities through
the [SDK](../../introduction/glossary.md), and Apps read them with `useAtlasSdk()`.

Declare your SDK in `src/host.config.tsx`. The file has three parts:

- `CustomerHostSdk`: the TypeScript type of your custom SDK members and host data.
- `HostProviders`: a component that wraps the whole Host. Put product providers here, such
  as a React Query `QueryClientProvider`.
- `useCustomHostSdkOptions()`: a hook that returns the SDK options. It runs inside the Host
  React tree, so it can call other hooks.

This example exposes the signed-in user as host data, plus an orders API and a toast
function. `useToast`, `loadCurrentUser`, `ordersApi`, `OrdersApi`, `PublicUser`, and
`monitoring` stand for your own product code:

```tsx
import { StrictMode, type ReactNode } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import type { HostSdkOptions } from '@atlas/runtime/react';

export interface CustomerHostSdk {
  hostData: {
    user: PublicUser | null | undefined;
  };
  orders: OrdersApi;
  showToast(message: string): void;
}

const queryClient = new QueryClient();

export function HostProviders({ children }: { children?: ReactNode }) {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StrictMode>
  );
}

export function useCustomHostSdkOptions(): HostSdkOptions<CustomerHostSdk> {
  const toast = useToast();
  const session = useQuery({ queryKey: ['session'], queryFn: loadCurrentUser });

  return {
    hostData: { user: session.data },
    orders: ordersApi,
    showToast: (message) => toast.show(message),
    observe: (event) => monitoring.capture('atlas.runtime', event),
  };
}
```

How Atlas uses these options:

- Atlas adds `hostData.hostId` and `hostData.name` from `atlas.config.ts`. You do not set them.
- Atlas creates the SDK once, from the options returned on the first render. After that,
  only `hostData` changes reach Apps. When `session.data` changes, Atlas updates the host
  data and re-renders React Apps that read it. Other members, such as `showToast`, keep the
  value from the first render, so they must not capture values that change later.
- `observe` receives every Atlas runtime event, such as resource loading, retries, Host
  readiness, and App mount state. Use it for monitoring.

A common convention for user data is `undefined` while loading and `null` when the user is
signed out.

> **Warning:** Everything in the SDK and host data is visible to every App in the browser.
> Never put access tokens, refresh tokens, API secrets, or publication credentials in host
> data, SDK options, `atlas.config.ts`, or `atlas.runtime.json`.

Use normal React state and context for state that only the Host needs. Put shared
TypeScript types, such as `CustomerHostSdk`, in a package that both the Host and the Apps
compile against. Share types, not live implementation code.

Read [React SDK](sdk.md) for how Apps consume these services, and
[Host data](../host-data.md) for patterns around live host data.

## 5. Add loading and error UI

Atlas shows functional default loading and error states. To use your design system, return
renderer functions from `useCustomHostSdkOptions()` alongside your SDK members:

```tsx
export function useCustomHostSdkOptions(): HostSdkOptions<CustomerHostSdk> {
  return {
    // ...your SDK members
    renderHostLoading: (container) => renderHostSkeleton(container),
    renderHostError: (container, error, retry) =>
      renderHostFailure(container, { error, retry }),
    renderLoading: (container, event) =>
      renderAppSkeleton(container, event.manifest.name),
    renderError: (container, event, retry) =>
      renderAppFailure(container, { app: event.manifest.name, retry }),
  };
}
```

| Option                                     | Covers                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `renderHostLoading`, `renderHostError`     | Atlas startup, rendered into `AtlasHostStatus`.                |
| `renderLoading`, `renderError`             | One routed or slotted App, rendered into that App's container. |
| `renderWidgetLoading`, `renderWidgetError` | One exported Widget.                                           |

Renderers receive DOM containers rather than React elements because Apps may use different
frameworks. Use a React portal, a separate root, or an imperative design-system API.
`renderHostLoading`, `renderHostError`, and the Widget renderers may return a cleanup
function; return one when you create a root or subscription.

A failing App shows its error UI in its own container. The rest of the Host keeps working.

## 6. Run the host locally

Start the Host:

```sh
npx atlas dev customer-host
```

The CLI starts three local servers:

| Default port | Server                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `4200`       | The local bootstrap. This is the URL you open in the browser.                                     |
| `4300`       | The internal Vite server for the Host code. Do not open it directly.                              |
| `4400`       | The local control server that [Columbus](../columbus.md) uses to switch App versions in the page. |

Change them with `--port`, `--host-client-port`, and `--control-port`. The CLI opens the
Host in your browser unless you pass `--no-open`.

In a second terminal, check that the bootstrap serves the runtime config:

```sh
curl --fail http://localhost:4200/atlas.runtime.json
```

> **Expected result:** The browser shows your layout. The Host status clears after startup.
> The route outlet stays empty until an App matches the current URL. The `curl` command
> prints a JSON document that contains your Host ID.

## 7. Mount an app during development

Apps choose their own URLs in their `atlas.config.ts`, so you do not add routes to the Host.
To see an App inside your Host, follow [Build a React app](app.md) or
[Build an Angular app](../angular/app.md), then run both projects at once:

```sh
# Terminal 1, workspace root
npx atlas dev customer-host
```

```sh
# Terminal 2, workspace root
npx atlas dev orders
```

> **Expected result:** Opening `http://localhost:4200/orders` shows Orders inside the route
> outlet. Refreshing `/orders/details/42` keeps you in Orders. Stopping the Orders process
> shows an error in the route outlet while the rest of the layout stays in place.

## 8. Build the host

Build the Host code, then generate the static bootstrap files:

```sh
npm --prefix customer-host run build
npx atlas bootstrap customer-host
```

The first command runs the generated `build` script (`tsc -b && vite build`). The second
writes the static entry files to `customer-host/dist/bootstrap/`. You build the bootstrap
once per Host; releasing a new Host or App version does not require rebuilding it.

> **Expected result:** `customer-host/dist/` contains the Vite build output, and
> `customer-host/dist/bootstrap/` contains `index.html` and the loader scripts.

## When you deploy

Publishing, deploying, and serving the Host in production are covered separately:

- [React production deployment](production-deployment.md) covers building, publishing, and
  verifying React artifacts.
- [Production deployment](../../deploy/production-deployment.md) covers registries,
  environments, and rollback.
- [Host bootstrap](../../deploy/bootstrap.md) covers serving the static entry files.
- [Security](../../deploy/security.md) covers response headers, Content Security Policy,
  and routing authentication and backend requests alongside the static Host.

## Common mistakes

- Opening the Vite port (`4300`) instead of the bootstrap URL (`4200`).
- Changing the Host ID after Apps already reference it.
- Removing `AtlasRouteOutlet` or the `default` layout while customizing the layout.
- Rendering host anchors outside the tree that `defineReactHost()` creates.
- Expecting SDK members other than `hostData` to update after the first render.
- Importing Host code into an App instead of exposing it through the SDK.
- Putting secrets or tokens in host data or runtime config.
- Hard-coding App routes in Host code instead of letting each App declare them.

## Next steps

- [Build a React app](app.md) to add your first App to this Host.
- [React routing](routing.md) for layouts, custom navigation, and deep links.
- [Testing apps and hosts](../testing-apps-and-hosts.md) for Host tests.
- [React troubleshooting](troubleshooting.md) if the Host does not start.
