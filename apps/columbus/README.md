# Atlas Columbus Extension

This Manifest V3 extension switches the app versions used by the Atlas host in the active tab. It does not modify host source code, Native Federation configuration, or CDN URLs.

## Build And Install

```bash
yarn workspace @atlas/columbus build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/columbus/dist`.

The extension requests `activeTab`, `scripting`, and `storage`. Static content scripts run on HTTP and HTTPS pages so Columbus can detect Atlas hosts, keep badges current, and connect local selections to loopback development sessions before Atlas starts. The interceptor only acts after a valid Atlas runtime configuration and catalog request are observed, respects `allowCustomOverrides`, and only reads matching development sessions from `localhost:4400`. Automatic discovery keeps preview URLs clean while making local selections visible in Columbus. Atlas uses a small main-world script to inspect the public runtime catalog and update that origin's Atlas override storage. No remote JavaScript is executed by the extension.

Chrome 111 or newer is required because Columbus uses main-world static content scripts.

## Source Layout

- `src/components` contains React components, providers, feature hooks, and their colocated tests and drivers.
- `src/scripts` contains browser entry points and domain scripts grouped by responsibility. A tested script owns a same-named folder containing its implementation, driver, and specs.
- `src/types` contains shared extension contracts and Chrome declarations.
- `src/index.html` is the Vite and extension UI entry document.
- `src/styles` and `src/icons` contain UI styles and extension assets.

## Use

1. Open an Atlas host.
2. Open the Atlas extension.
3. Choose current production, previous production, PR, or local version for each app.
4. Keep **All tabs** selected (the default), or choose **This tab** for an isolated experiment.
5. Select **Save**. Columbus persists the selection, then reloads the host.

Production is default. Labels include semantic version and short build ID, so multiple builds sharing one version remain distinct. PR and historical versions come from static app index. For custom development, paste any HTTP or HTTPS base URL. Columbus derives `remoteEntry.json` from that URL. Remote origins must be permitted by host's Content Security Policy.

All-tabs overrides are stored by `hostId` in `chrome.storage.local` and copied to the host origin's `localStorage`. Current-tab overrides use `sessionStorage` and take precedence in that tab. The SDK validates the complete document and every manifest before federation initialization.

Choosing the current production version creates an explicit production selection. With **All tabs**, it replaces the origin-wide selection. With **This tab**, it takes precedence over any all-tabs override in that tab.

If one app version index is unavailable, the extension keeps the host usable, shows a warning, and still offers that app's production version. Local manifests are validated for structure, app identity, and host compatibility before they can be applied.

## Verification

`yarn test:e2e` loads the built Manifest V3 extension in Playwright's bundled Chromium and exercises historical, PR, local, reset, all-tabs, current-tab, and invalid-URL workflows against the example Atlas deployment. Columbus has permanent loopback-only host permissions for local development discovery; all non-loopback page access still depends on the active tab and static content-script matches.

## Troubleshooting

- **This page does not expose a valid Atlas runtime configuration**: the active page must serve `/atlas.runtime.json`.
- **Catalog URL does not identify the static registry**: the extension expects `/hosts/<hostId>/catalog.json` under the Atlas storage root.
- **Custom URL is rejected**: use absolute HTTP or HTTPS URL without credentials, query parameters, or fragment.
- **A version is disabled**: its manifest does not declare compatibility with the current host.
