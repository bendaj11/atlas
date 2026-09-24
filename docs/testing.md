# Testing The Atlas Repository

This page documents development of the Atlas source repository, which uses
pnpm. Generated consumer projects are verified with both Yarn and pnpm, and
Atlas also supports npm workspaces.

For host and app teams testing generated products, read
[Consumer testing](consumer-testing.md) instead.

Atlas has two test layers. `pnpm test` runs fast contract, SDK, runtime, generator, CLI, and Columbus extension tests. `pnpm test:e2e` runs the runtime browser suite and proves that production-built applications work together in a browser. The deployment suite lives in the `examples/e2e` workspace (`@atlas-example/e2e`).

`pnpm test:generated` adds a package-boundary gate. It packs every public Atlas package, installs those tarballs in isolated Yarn and pnpm projects, invokes the packaged CLI, and production-builds newly generated Angular and React hosts and apps with both package managers.

## Deployment E2E

Install the pinned browser once:

```sh
pnpm exec playwright install chromium
```

Run the complete workflow:

```sh
pnpm test:e2e
```

The command performs the following work without requiring a real cloud account:

1. Builds Atlas packages.
2. Builds the Angular and React example hosts and apps.
3. Publishes their immutable releases and canonical manifests into one temporary
   static registry.
4. Deploys host and app selections to environment-qualified active host manifests.
5. Starts separate CDN, React-host, and Angular-host origins.
6. Runs Playwright against the deployed output.
7. Deploys older and newer immutable app releases and proves the same prebuilt
   host loads each selected release.

The suite verifies Angular apps in React hosts, React apps in Angular hosts, framework-native inner routing, cross-framework widgets, popups, opt-in loading UI, failed-remote fallback UI, CORS, and mutable versus immutable cache headers.

It also loads the built Columbus extension into Playwright's bundled Chromium. The extension scenarios cover PR/MR previews, other releases, and local versions; all-tabs and current-tab scope; current-deployment reset; invalid manifests; and non-Atlas pages. The E2E harness grants localhost access only to a temporary copy because headless Chromium does not expose the toolbar popup's temporary `activeTab` permission reliably. A separate build test guarantees that the extension users install has no permanent host permissions.

Generated deployment files live under `examples/e2e/.artifacts` and are not committed.

## Faster Browser Iteration

Prepare production files once, then rerun only Playwright:

```sh
pnpm --filter @atlas-example/e2e run fixtures
pnpm exec playwright test --config examples/e2e/playwright.config.ts
```

Use Playwright's normal filtering and debugging flags when working on one scenario:

```sh
pnpm exec playwright test --config examples/e2e/playwright.config.ts -g "Angular host mounts a React app"
pnpm exec playwright test --config examples/e2e/playwright.config.ts --headed
```

## CI

The repository workflow installs Chromium and runs type checking, unit/integration tests, and the complete deployment E2E suite. A failure retains Playwright traces and screenshots in the workflow artifacts.
