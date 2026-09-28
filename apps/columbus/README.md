# Columbus

Columbus is the Atlas local development browser extension for Chrome. It lets you replace the deployed version of an Atlas Host or App with a local build, a PR preview, or another published release, in your own browser only. It does not change Host source code, federation configuration, the deployment, or the artifact registry.

You do not need Columbus to run a local Host with local Apps; the local Host page reads the development session directly. For usage, see the [Columbus guide](https://github.com/bendaj11/atlas/blob/main/docs/guides/columbus.md).

## Build and install

Columbus requires Chrome 111 or later. It is not published to npm. It is versioned and distributed separately from the `@atlas/*` packages.

1. From the repository root, install dependencies and build the extension:

   ```sh
   pnpm install
   pnpm --filter @atlas/columbus build
   ```

   The build writes the unpacked extension to `apps/columbus/dist`.

2. Open `chrome://extensions`, turn on **Developer mode**, select **Load unpacked**, and choose `apps/columbus/dist`.

## Permissions

Columbus requests the `activeTab`, `scripting`, `storage`, and `tabs` permissions, and host permissions only for `http://localhost/*` and `http://127.0.0.1/*`. It uses the loopback permissions to reach the development session that `npx atlas dev` serves, on port 4400 by default.

It runs these content scripts:

- On every `http` and `https` page, a development-session bridge that lets the Atlas loader request local builds from Columbus, and a badge script that keeps the override count on the toolbar icon current.
- On `localhost` pages, a preview launcher that focuses an existing preview tab when `npx atlas dev` opens the browser.

Columbus does not execute remote JavaScript itself. The Atlas loader loads the selected versions and validates them. Local builds must use loopback URLs, and published versions must come from the Host's registry origins.

## Where overrides are stored

- **All tabs:** in `chrome.storage.local`, keyed by host ID, and in the Host origin's `localStorage`.
- **This tab:** in the Host origin's `sessionStorage`. It takes precedence over an **All tabs** override in that tab.

The Atlas loader reads overrides from the page storage key `atlas.runtime-overrides`.

## Published versions

Columbus reads published releases and PR previews from `<artifactRegistryUrl>/registry.json`, where `artifactRegistryUrl` comes from the page's `/atlas.runtime.json`. If one artifact's versions cannot be loaded, Columbus shows a warning and keeps the rest usable.

## Source layout

- `src/components`: React components with their colocated tests and drivers.
- `src/scripts`: browser entry points (background, badge, development session, preview launcher), grouped by responsibility.
- `src/utils`, `src/hooks`, `src/providers`: shared logic for the popup.
- `src/types`: shared extension contracts and Chrome declarations.
- `src/index.html`: the popup entry document.
- `public/manifest.json`: the Manifest V3 extension manifest.

## Tests

Run the unit tests from the repository root:

```sh
pnpm --filter @atlas/columbus test
```

`pnpm test:e2e` includes `examples/e2e/extension.specs.ts`, which loads the built extension in Playwright's Chromium and exercises published, PR, local, reset, all-tabs, this-tab, and invalid-URL workflows against the example deployment.

## Troubleshooting

- **No Atlas Host found:** the page must serve a valid `/atlas.runtime.json`.
- **Custom URL is rejected:** use the base URL of a running local development server that serves `remoteEntry.json`.
- **A version is disabled:** its manifest does not support the current Host.
