# Atlas Columbus Extension

This Manifest V3 extension switches the app versions used by the Atlas host in the active tab. It does not modify host source code, Native Federation configuration, or CDN URLs.

## Build And Install

```bash
yarn workspace @atlas/columbus build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/columbus/dist`.

The extension requests `activeTab`, `scripting`, and `storage`. Static content scripts run on HTTP and HTTPS pages so Columbus can detect Atlas hosts, keep badges current, and connect production hosts to loopback development sessions before Atlas starts. The interceptor only acts after a valid Atlas runtime configuration and catalog request are observed, respects `allowOverrides`, and only reads development sessions from `localhost:4400`. Atlas uses a small main-world script to inspect the public runtime catalog and update that origin's Atlas override storage. No remote JavaScript is executed by the extension.

Chrome 111 or newer is required because Columbus uses main-world static content scripts.

## Use

1. Open an Atlas host.
2. Open the Atlas extension.
3. Choose one version for each app.
4. Keep **All tabs** selected (the default), or choose **This tab** for an isolated experiment.
5. Select **Apply and reload**.

Production is the default. PR and historical versions come from the host static app index. For local development, paste either an app manifest URL or the `atlas.local-overrides.json` URL printed by `atlas dev`.

All-tabs overrides are stored by `hostId` in `chrome.storage.local` and copied to the host origin's `localStorage`. Current-tab overrides use `sessionStorage` and take precedence in that tab. The SDK validates the complete document and every manifest before federation initialization.

Choosing **Use production** updates the current selection; choose **Apply and reload** to commit it. With **All tabs**, Atlas removes the origin-wide override. With **This tab**, Atlas stores an empty tab override so that one tab can stay on production while other tabs continue using an all-tabs override.

If one app version index is unavailable, the extension keeps the host usable, shows a warning, and still offers that app's production version. Local manifests are validated for structure, app identity, and host compatibility before they can be applied.

## Verification

`yarn test:e2e` loads the built Manifest V3 extension in Playwright's bundled Chromium and exercises historical, PR, local, reset, all-tabs, current-tab, and invalid-manifest workflows against the example Atlas deployment. The harness adds localhost access to a temporary extension copy because headless Chromium cannot reliably expose a toolbar popup's transient `activeTab` grant. The built extension is separately asserted to contain no permanent `host_permissions`.

## Troubleshooting

- **This page does not expose a valid Atlas runtime configuration**: the active page must serve `/atlas.runtime.json`.
- **Catalog URL does not identify the static registry**: the extension expects `/hosts/<hostId>/catalog.json` under the Atlas storage root.
- **Local manifest returned an error**: keep `atlas dev` running and use its control URL.
- **A version is disabled**: its manifest does not declare compatibility with the current host.
