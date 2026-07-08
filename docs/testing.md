# Testing The Atlas Repository

This page documents development of the Atlas source repository, which uses
Yarn. Generated consumer projects are verified with both Yarn and pnpm, and
Atlas also supports npm workspaces.

For host and app teams testing generated products, read
[Consumer testing](consumer-testing.md) instead.

Atlas has two test layers. `yarn test` runs fast contract, SDK, runtime, generator, CLI, and Chrome extension tests. `yarn test:e2e` proves that production-built applications work together in a browser.

`yarn test:generated` adds a package-boundary gate. It packs every public Atlas package, installs those tarballs in isolated Yarn and pnpm projects, invokes the packaged CLI, and production-builds newly generated Angular and React hosts and apps with both package managers.

## Deployment E2E

Install the pinned browser once:

```sh
yarn playwright install chromium
```

Run the complete workflow:

```sh
yarn test:e2e
```

The command performs the following work without requiring a real cloud account:

1. Builds Atlas packages.
2. Builds the Angular and React example apps through `atlas build`.
3. Merges their provider-neutral publications into one temporary static registry.
4. Builds Angular and React hosts.
5. Starts separate CDN, React-host, and Angular-host origins.
6. Runs Playwright against the deployed output.
7. Publishes two immutable app releases, rolls the live catalog backward and
   forward, and proves the same prebuilt host loads each selected release.

The suite verifies Angular apps in React hosts, React apps in Angular hosts, framework-native inner routing, cross-framework widgets, popups, opt-in loading UI, failed-remote fallback UI, CORS, and mutable versus immutable cache headers.

It also loads the built Chrome extension into Playwright's bundled Chromium. The extension scenarios cover PR, historical, and local versions; all-tabs and current-tab scope; production reset; invalid manifests; and non-Atlas pages. The E2E harness grants localhost access only to a temporary copy because headless Chromium does not expose the toolbar popup's temporary `activeTab` permission reliably. A separate build test guarantees that the extension users install has no permanent host permissions.

Generated deployment files live under `tests/e2e/.artifacts` and are not committed.

## Faster Browser Iteration

Prepare production files once, then rerun only Playwright:

```sh
yarn test:e2e:prepare
yarn playwright test
```

Use Playwright's normal filtering and debugging flags when working on one scenario:

```sh
yarn playwright test -g "Angular host mounts a React app"
yarn playwright test --headed
```

## CI

The repository workflow installs Chromium and runs type checking, unit/integration tests, and the complete deployment E2E suite. A failure retains Playwright traces and screenshots in the workflow artifacts.
