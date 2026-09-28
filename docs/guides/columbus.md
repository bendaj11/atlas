---
title: Columbus
description: Install the Columbus browser extension and use it to run local, PR preview, and other published versions of a Host or App inside a deployed Atlas page.
---

# Columbus

Columbus is the Atlas local development browser extension for Chrome. It lets you replace the deployed version of a Host or App with a local build, a PR preview, or another published release, in your browser only. This page explains what Columbus does, when you need it, how to install it, and what protects the page while you use it.

## What Columbus does

A deployed Atlas page loads a fixed set of versions: the Host and the Apps that the environment's deployment selects. Columbus stores an _override_ for the page you are on. On the next page load, the Atlas loader reads the override and swaps in the version you chose before the Host starts. The Host and the Apps need no override logic of their own.

With Columbus you can:

- run an App or Host from `npx atlas dev` inside a deployed page, such as staging;
- load the current PR preview of a Host or App;
- load another published release, for example the previous production version;
- keep an override for one tab or for every tab of that site;
- turn an override off temporarily or clear it.

Columbus changes only what your browser loads. It never changes the deployment, the artifact registry, or what other users see.

## When you need Columbus

You do not need Columbus to develop against a Host that runs on your own machine. When `atlas.previews` points to a `localhost` Host page that `npx atlas dev` serves, the local Host page reads your local Apps from the [development session](../introduction/glossary.md#development-session) on port 4400. See [Local development](local-development.md).

You need Columbus when you want to:

- run a local App or Host inside a deployed page, such as `https://staging.example.com`;
- select PR previews or other published releases in any Host.

## Install Columbus

Columbus requires Chrome 111 or later. Columbus is versioned and distributed separately from the `@atlas/*` npm packages. If your organization distributes a Columbus build, install that build. Otherwise, build it from the Atlas source repository.

To build and load Columbus from source:

1. Clone the Atlas repository and install its dependencies from the repository root. The repository uses pnpm:

   ```sh
   git clone https://github.com/bendaj11/atlas.git
   cd atlas
   pnpm install
   ```

2. Build the extension from the repository root:

   ```sh
   pnpm --filter @atlas/columbus build
   ```

   > **Expected result:** The build writes the unpacked extension to `apps/columbus/dist`.

3. Open `chrome://extensions` in Chrome and turn on **Developer mode**.
4. Select **Load unpacked** and choose the `apps/columbus/dist` folder.

   > **Expected result:** **Columbus by Atlas** appears in the extension list. Pin it to the toolbar so that you can open it from any Atlas page.

## Choose a version for an artifact

1. Open a page that an Atlas Host serves.
2. Select the Columbus icon in the Chrome toolbar.

   > **Expected result:** Columbus lists the Host and every App in the page's deployment, with the version each one currently loads. If the page is not an Atlas Host, Columbus shows **No Atlas Host found**.

3. Select **Edit** on the Host or App you want to change.
4. Choose where the new version comes from:
   - **Production** lists the releases published to the Host's artifact registry. Pick any release, for example the previous one.
   - **PR Preview** lists the current PR previews of that artifact. See [PR previews](pr-previews.md).
   - **Custom URL** takes the base URL of a local development server, such as `http://localhost:4201`. Columbus loads `remoteEntry.json` from that URL.
5. Choose the scope:
   - **All tabs** applies the override to every tab of this site.
   - **This tab** applies it only to the current tab and takes precedence over an **All tabs** override there.
6. Select **Save**.

   > **Expected result:** Columbus reloads the tab, and the page runs the version you chose. The Columbus toolbar icon shows the number of active overrides.

To go back, select **Clear** for one artifact in the list. The list also has a switch per override, which turns it off without deleting it.

A version is disabled in the list when its manifest does not support the current Host. Columbus also checks a custom URL before it saves it: the development server must be running and must serve valid federation metadata.

## Use Columbus with `npx atlas dev`

When `npx atlas dev` runs, it serves the development session on port 4400 by default. On every load of a deployed Atlas page, Columbus asks the development session for the local builds it offers, and the loader applies them automatically. You do not need to enter a custom URL.

If you start `npx atlas dev` with another `--control-port`, open the preview URL that `npx atlas dev` prints. That URL carries the port, and Columbus remembers it for the tab.

See [Local development](local-development.md#run-inside-a-deployed-page) for the complete workflow.

## Recover from a broken override

A broken Host override can fail before the Host renders any UI. Recovery does not depend on the overridden Host:

- If Atlas cannot start, the loader's error page offers **Clear overrides and reload**.
- In Columbus, clear the override of the broken Host or App.

## How Columbus keeps the page safe

Columbus and the loader apply these rules to every override:

- **Local builds must come from your machine.** A local override must use a loopback URL (`localhost`, `127.0.0.1`, or `[::1]`). Columbus only has network permission for `http://localhost` and `http://127.0.0.1`, which it uses to reach the development session that `npx atlas dev` serves.
- **Published versions must come from the Host's registry.** A published Host must load over HTTPS from the origin of the Host's `artifactRegistryUrl`. A published App must load from the origin of `artifactRegistryUrl` or `environmentRegistryUrl` in the Host's runtime config. When the registry lists the selected version, the loader reads its manifest from the registry and checks it against the digest recorded there. If the loader cannot derive the registry root from the manifest, cannot fetch `registry.json`, or finds no matching entry, it uses the manifest that Columbus supplied unchanged. The origin checks still apply, but the registry digest check is skipped.
- **A Host override must match the page.** The manifest must be a Host manifest with the host ID of the page, and it must require a compatible loader API version.
- **App overrides must fit the Host.** An App must support the current Host, and a published App override must replace an App in the deployment or a Widget provider that an App in the deployment depends on.
- **Nothing is changed on the server.** Overrides live only in the browser: in the page's `localStorage` or `sessionStorage` and in the extension's own storage.

Columbus requests the `activeTab`, `scripting`, `storage`, and `tabs` permissions. It runs a small content script on every page. The script lets an Atlas loader ask Columbus for a development session and keeps the override count on the toolbar icon up to date.

> **Warning:** Every Atlas Host, including production, applies an override that is stored in the page's own storage. There is no setting that turns this off. The rules above limit an override to loopback code on the user's own machine or to artifacts published in the Host's artifact registry. Treat publish access to that registry as production code access. See [Security](../deploy/security.md).

## Next steps

- [Local development](local-development.md)
- [PR previews](pr-previews.md)
- [Troubleshooting](../troubleshooting.md)
