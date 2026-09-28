---
title: Testing the Atlas repository
description: Learn which test suites the Atlas repository has, when to run each one, and how to iterate on browser tests.
---

# Testing the Atlas repository

This page explains how to test changes to the Atlas source repository. It is for contributors who work on the packages, Columbus, the examples, or the scripts. If you build Hosts or Apps with Atlas and want to test them, read [Testing apps and hosts](../docs/guides/testing-apps-and-hosts.md) instead.

The repository uses pnpm. Generated consumer projects are verified with both Yarn and pnpm.

## Test suites

Atlas has three test commands. Run them from the repository root.

| Command               | What it runs                                                                                                                                                                          | Run it when you change                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `pnpm test`           | The Jest unit and integration specs of every `@atlas/*` workspace package, including Columbus, followed by the specs in `scripts/`                                                    | Anything                                           |
| `pnpm test:generated` | `pnpm pack:verify`, then packs every public package, installs the tarballs in isolated Yarn and pnpm projects, and production-builds newly generated Angular and React hosts and apps | Generators or package boundaries                   |
| `pnpm test:e2e`       | The end-to-end suites of the CLI, SDK, and runtime packages, then the browser deployment suite in `examples/e2e` (`@atlas-example/e2e`)                                               | Runtime loading, navigation, catalogs, or Columbus |

While you iterate on one spec, run only that file instead of the full suite:

```sh
node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.json --testPathPattern=path/to/file.specs.ts
```

> **Note:** `jest.config.json` limits Jest to `maxWorkers: 50%` and `workerIdleMemoryLimit: 512MB`. Do not override `--maxWorkers` locally.

Columbus has its own Jest configuration. Pass `--config apps/columbus/jest.config.cjs` when you run a single Columbus spec.

## Run the deployment end-to-end suite

The deployment suite proves that production-built Hosts and Apps work together in a real browser, without a cloud account.

1. Install the pinned Chromium build once:

   ```sh
   pnpm exec playwright install chromium
   ```

2. Run the complete workflow:

   ```sh
   pnpm test:e2e
   ```

   The command builds the Atlas packages and runs the package end-to-end suites. The deployment suite then performs the following work:
   1. It builds the Angular and React example hosts and apps.
   2. It publishes their immutable releases and manifests into one temporary static registry.
   3. It deploys host and app selections to environment-specific host manifests.
   4. It starts separate CDN, React host, and Angular host origins.
   5. It runs Playwright against the deployed output.
   6. It deploys older and newer immutable app releases and proves that the same prebuilt host loads each selected release.

   > **Expected result:** Playwright reports every scenario as passed.

The suite covers Angular apps in React hosts, React apps in Angular hosts, framework-native inner routing, cross-framework widgets, popups, opt-in loading UI, the fallback UI for a failed remote, CORS, and mutable versus immutable cache headers.

It also loads the built Columbus extension into the Chromium build that Playwright bundles. The extension scenarios cover PR and MR previews, other releases, and local versions; all-tabs and current-tab scope; resetting to the current deployment; invalid manifests; and pages that do not use Atlas. The harness grants localhost access only to a temporary copy of the extension, because headless Chromium does not reliably expose the temporary `activeTab` permission of the toolbar popup. A separate build test guarantees that the extension users install has no permanent host permissions.

Generated deployment files live under `examples/e2e/.artifacts` and are not committed.

## Iterate faster on browser tests

Prepare the production files once, and then rerun only Playwright:

```sh
pnpm --filter @atlas-example/e2e run fixtures
pnpm exec playwright test --config examples/e2e/playwright.config.ts
```

Use the normal Playwright filtering and debugging flags when you work on one scenario:

```sh
pnpm exec playwright test --config examples/e2e/playwright.config.ts -g "Angular host mounts a React app"
pnpm exec playwright test --config examples/e2e/playwright.config.ts --headed
```

## Continuous integration

The Verify workflow in `.github/workflows/verify.yml` runs on every pull request and on every push to `main`:

- The `docs` job runs `pnpm verify:docs` on every run.
- The `quality` job runs type checking, linting, and unit tests on Node.js 22 and 24. On pull requests that change code, scripts, workflows, or workspace configuration, it checks only the affected packages. Pushes to `main` check everything.
- The `package-artifacts`, `portability`, `generated-projects`, and `e2e` jobs run on pushes to `main` and on pull requests that change code, scripts, workflows, or workspace configuration.

When the browser suite fails, the workflow keeps the Playwright report and test results as workflow artifacts.

## Related

- [Releasing](releasing.md)
- [Documentation guide](documentation-guide.md)
