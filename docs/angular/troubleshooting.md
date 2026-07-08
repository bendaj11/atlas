# Angular Troubleshooting

Start by identifying the domain:

- **Host domain:** page shell, runtime config, catalog URL, DOM anchors,
  `startHost`, host SDK providers.
- **App domain:** Angular app source, `atlas.config.ts`, `src/entry.ts`,
  inner routes, assets.
- **Deployment domain:** CDN files, CORS, MIME types, catalogs, registry,
  integrity, cache.

## The App Does Not Load

Check deployment first:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

Then check host layout:

- `data-atlas-route-outlet` exists;
- `data-atlas-host-status` exists;
- the host serves `index.html` for deep links;
- `atlas.runtime.json` points to the expected catalog.

Then check app config:

- `framework: "angular"`;
- route `hostId` matches the host runtime `hostId`;
- route `basePath` matches the URL being opened;
- `supportedHosts` or route declarations allow the host.

## Angular Remote Entry Does Not Load

Verify `remoteEntryUrl` points to `remoteEntry.json`, not a JavaScript file.
The CDN must serve every file from the Angular browser output with CORS enabled.
Atlas loads the Native Federation expose named by the manifest.

## Inner Routing Escapes The App

The app should use `createLocationStrategy(context)` through generated
`src/entry.ts`. Do not provide `PathLocationStrategy` inside a mounted Angular
app. Use Angular Router for app-relative paths and SDK navigation for
cross-app destinations.

## Host APIs Are Missing

If `injectAtlasSdk()` returns an SDK without expected product fields, fix the
host `startHost` call. Product `hostData`, HTTP clients, modals, toasts, events,
and extensions are supplied by the host, not by the app.

## Spinner Never Disappears

If the app calls `injectAppLoaded()` or `context.loading.waitUntilReady()`, it
must call the returned callback after first useful render. Otherwise Atlas times
out, unmounts the app, and shows the host-owned fallback.

## Install Fails With Peer Conflicts

In workspaces that already declare `@angular/core`, Atlas aligns companion
Angular packages to the existing major. Upgrade or downgrade the workspace
Angular version first, or create a project-level package with its own framework
version.
