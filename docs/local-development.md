# Local Development

Atlas local development is designed around one principle: run the MF locally, but render it in the real host.

## Why

MFs depend on host services such as user data, navigation, modals, toasts, and configuration. Running them as standalone apps gives a false picture of production behavior.

## Flow

```sh
atlas dev orders-angular --host=demo-angular-host --host-url=https://host.example/orders
```

The command:

1. Generate a local manifest pointing to localhost.
2. Start the selected MF's framework dev server.
3. Wait until its Native Federation remote entry is reachable.
4. Serve a validated override document from the Atlas control server.
5. Print a host URL that activates the override.
6. Let the host load every production MF except the one being overridden.

Open the printed **Open host** URL. The host discovers the override from its `atlas-override` query parameter, while every other MF continues to come from the production catalog. No Native Federation URL or manifest needs editing.

Defaults are MF port `4201` and Atlas control port `4400`. Use `--port` or `--control-port` only when necessary. Atlas writes a diagnostic copy to `.atlas/local-overrides.json`; developers do not maintain it.

The control server reports `503 starting` until the MF is ready, so opening the printed URL cannot race framework startup. Generated React MFs also initialize Vite Fast Refresh when imported by a host; Angular and React developers get their normal framework development behavior without extra setup.

Generated hosts accept an override URL under `atlas.runtime-override-url` and a complete override document under `atlas.runtime-overrides` in browser local storage. `atlas dev` uses the URL protocol; the Chrome extension uses the direct document protocol so it needs no background HTTP server of its own. Both receive the same SDK validation.

## What Happens Behind The Scenes

```mermaid
sequenceDiagram
  participant CLI as Atlas CLI
  participant MF as Local MF server
  participant Control as Atlas control server
  participant Host as Production host
  participant CDN as Registry/CDN
  CLI->>MF: Start framework dev server
  CLI->>MF: Wait for remoteEntry.json
  CLI->>Control: Mark override ready
  Host->>CDN: Fetch production catalog
  Host->>Control: Fetch local override
  Host->>MF: Load selected local remote
  Host->>CDN: Load other production remotes
```

Atlas rejects an override that targets another host, has an invalid manifest, or uses an MF id that differs from its embedded manifest.

## PR And Historical Versions

The same override protocol can choose:

- a PR version for review
- a historical version for debugging
- a local version for development

The host does not need to redeploy for these changes.

## Chrome Extension

Build the extension with `yarn workspace @atlas/chrome-extension build`, then load `apps/chrome-extension/dist` as an unpacked extension from `chrome://extensions`.

The popup discovers the active host from `/atlas.runtime.json`, reads its catalog, and reads each static MF index for all versions of each selected MF. Choices are persisted per `hostId`. Applying changes writes one atomic override document into the host origin and reloads the tab. Widgets follow their owner MF version automatically and are not selected independently.

Overrides apply to **All tabs** by default using origin `localStorage`. Choose **This tab** to keep an experiment isolated in `sessionStorage`; a tab override takes precedence over an all-tabs override without changing other open tabs.

For local development, paste the override URL printed by `atlas dev`. The extension extracts the selected MF's local manifest and persists it with the other choices.

Choose **Use production**, then **Apply and reload**, to remove overrides. In **This tab** mode this creates a tab-only production choice, which intentionally takes precedence over any all-tabs override. In **All tabs** mode it removes the shared override completely.
