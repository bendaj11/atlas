# React Troubleshooting

Start by identifying the domain:

- **Host domain:** page shell, bootstrap metadata, discovery, active host manifest URL, DOM anchors,
  `startHost`, host SDK providers.
- **App domain:** React app source, `atlas.config.ts`, `src/bootstrap.tsx`,
  inner routes, assets.
- **Deployment domain:** CDN files, CORS, MIME types, `registry.json`, active and
  canonical manifests, integrity, cache.

## The App Does Not Load

Check deployment first:

```sh
atlas verify --host-url=https://customer.example
```

Then check host layout:

- `data-atlas-route-outlet` exists;
- `data-atlas-host-status` exists;
- the host serves `index.html` for deep links;
- host discovery selects the expected environment-qualified active host
  manifest for the page URL.

Then check app config:

- `framework: "react"`;
- route `hostId` matches the host runtime `hostId`;
- route `path` matches the URL being opened;
- `supportedHosts` or route declarations allow the host.

## Inner Routing Escapes The App

Mounted React apps should use `createMemoryRouter` with
`createRouterOptions(context)`. Do not use `createBrowserRouter` inside a
mounted app. Use React Router for app-relative paths and SDK navigation for
cross-app destinations.

## Host APIs Are Missing

If `useAtlasSdk()` returns an SDK without expected product fields, fix the host
`startHost` call. Product `hostData`, API clients, modals, toasts, events, and
extensions are supplied by the host, not by the app.

## Spinner Never Disappears

If the app calls `useAppLoaded()` or `context.loading.waitUntilReady()`, it must
call the returned callback after first useful render. Otherwise Atlas times out,
unmounts the app, and shows the host-owned fallback.

## Asset URLs Break In Production

Use Vite imports or relative URLs. Do not use `/assets/...` in a mounted app
unless the host deliberately serves that path.

## A Local Workspace Package Loads From The CDN

Atlas shares imported runtime dependencies by default. Exclude app-local
workspace packages from federation so Vite bundles and serves their linked
source locally:

```ts
createReactAppViteConfig({
  projectRoot: __dirname,
  projectName: 'orders',
  reactMajor: 19,
  skip: [
    (packageName) =>
      packageName === '@company/orders-ui' ||
      packageName.startsWith('@company/orders-ui/'),
  ],
});
```

Keep dependencies that must be singleton-shared between the host and apps out
of `skip`.

## Install Fails With Peer Conflicts

In workspaces that already declare `react`, Atlas aligns companion React
packages to the existing major. Upgrade or downgrade the workspace React version
first, or create a project-level package with its own framework version.
