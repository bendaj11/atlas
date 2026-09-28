---
title: Errors reference
description: Every Atlas error code, where it is raised, what it means, and how to fix it.
---

# Errors reference

This page lists the error codes that Atlas packages raise, grouped by where you see them: the CLI, generators, federation build config, the bootstrap loader, the host runtime, and the SDK. Search this page for the code in your terminal output or browser console to find the cause and the usual fix. For symptom-based help, see [Troubleshooting](../troubleshooting.md).

## Error shape

Every Atlas failure is an `AtlasError` (exported from `@atlas/schema`) or a subclass. It carries:

| Property           | Description                                                                       |
| ------------------ | --------------------------------------------------------------------------------- |
| `code`             | Stable code, such as `ATLAS_PROJECT_NOT_FOUND`. Use it in scripts and monitoring. |
| `summary`          | Plain-language description of what failed.                                        |
| `suggestedActions` | One or more concrete recovery steps.                                              |
| `surface`          | `cli`, `browser`, or `universal`.                                                 |
| `cause`            | The original error, with its stack trace.                                         |
| `message`          | The summary followed by the suggested actions.                                    |

The CLI prints the summary, the numbered suggested actions, and each cause, then exits with status `1`. In the browser, Atlas logs a structured object to the console and shows the suggested actions in the startup or fallback UI.

The suggested actions in the tables below are shortened. The real error message names the exact file, URL, ID, or flag involved.

## CLI errors

Raised by `npx atlas` commands. Errors that Atlas cannot classify use `ATLAS_CLI_FAILURE`.

| Code                             | Meaning                                                                                     | Typical fix                                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ATLAS_UNKNOWN_COMMAND`          | The command or its required arguments are missing or unknown.                               | Run `npx atlas --help` and retry with a supported command.                                                                       |
| `ATLAS_CLI_FAILURE`              | A command failed with an error that has no specific code. The summary names the command.    | Read the cause lines under the message.                                                                                          |
| `ATLAS_PROJECT_NOT_FOUND`        | No Atlas project matches the name you passed.                                               | Pass the package name, Nx project name, or directory. Generate the project if it does not exist.                                 |
| `ATLAS_PROJECT_AMBIGUOUS`        | Several projects share that name.                                                           | Pass the project directory instead of its name.                                                                                  |
| `ATLAS_CONFIG_INVALID`           | The compiled config does not default-export an Atlas config.                                | Default-export the object in `atlas.config.ts`, then run the command again.                                                      |
| `ATLAS_CONFIG_NOT_COMPILED`      | `.atlas/atlas.config.js` is missing, usually after `--skip-compile`.                        | Run without `--skip-compile`, or run `npx atlas compile-config <project>` first.                                                 |
| `ATLAS_ARTIFACTS_MISSING`        | `publish` found no build output containing the remote entry.                                | Run the production build first. Pass `--entry` if the remote entry has another name.                                             |
| `ATLAS_REGISTRY_URL_MISSING`     | A non-local build needs a registry URL.                                                     | Pass `--registry-url` or set `ATLAS_REGISTRY_URL`.                                                                               |
| `ATLAS_REGISTRY_CONFIG_MISSING`  | The file passed to `--registry-config` does not exist.                                      | Pass the path of an existing `atlas.registry.ts`.                                                                                |
| `ATLAS_STORAGE_NOT_CONFIGURED`   | No storage provider is configured.                                                          | Pass `--storage s3 --bucket <name>`, set `ATLAS_STORAGE=artifactory`, or configure `storage` in `atlas.registry.ts`.             |
| `ATLAS_LOCK_TIMEOUT`             | Another writer held the S3 deployment lock for too long.                                    | Wait for the other job to finish and retry. Delete a stale `.atlas/deployment.lock` only after you confirm no writer is running. |
| `ATLAS_VERSION_SELECTOR_INVALID` | The `deploy --version` value is not a published release, `latest`, or a source environment. | Pass a version that exists in the source `registry.json`, `latest`, or an environment name.                                      |
| `ATLAS_PREVIEW_CLOSED`           | The pull request for this preview is closed or merged.                                      | Nothing to publish. Skip preview publication for closed pull requests.                                                           |
| `ATLAS_PREVIEW_STALE`            | The pull request has a newer head commit than the one you built.                            | Let the CI job for the current head commit publish the preview.                                                                  |
| `ATLAS_DEV_SERVER_TIMEOUT`       | The framework dev server exited, or did not serve the remote entry within 120 seconds.      | Check the framework output above the error for build errors. Pass `--port` if the server uses another port.                      |

## Generator errors

Raised by `npx atlas generate` and by `@atlas/generators`.

| Code                                    | Class                                | Meaning                                                         | Typical fix                                                                                          |
| --------------------------------------- | ------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ATLAS_GENERATOR_INVALID_ID`            | `InvalidGeneratorIdError`            | A name or ID breaks the ID rules.                               | Use 1 to 214 lowercase letters and numbers, with single hyphens between words, such as `orders-app`. |
| `ATLAS_GENERATOR_UNSUPPORTED_FRAMEWORK` | `UnsupportedGeneratorFrameworkError` | The framework is not `angular` or `react`.                      | Pass `--framework angular` or `--framework react`.                                                   |
| `ATLAS_GENERATOR_INVALID_VERSION`       | `InvalidFrameworkVersionError`       | `--framework-version` is not a valid version or range.          | Pass a version or range such as `^20.0.0` or `19.2.8`.                                               |
| `ATLAS_GENERATOR_UNVERIFIED_VERSION`    | `UnverifiedFrameworkVersionError`    | The requested framework major version is not verified by Atlas. | Pick a verified major, or pass `--allow-unsupported-version`. See [Compatibility](compatibility.md). |

## Federation build errors

Raised at build time by the config factories in `@atlas/sdk/federation-config` as `FederationConfigError`.

| Code                                       | Meaning                                                            | Typical fix                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `ATLAS_SHARED_PACKAGE_NOT_INSTALLED`       | A shared dependency is declared but cannot be resolved.            | Install the package in the project, then rebuild.                                             |
| `ATLAS_SHARED_ENTRY_NOT_EXPORTED`          | An imported subpath is not listed in the package's `exports`.      | Import a subpath the package exports, or skip it in the federation config so Vite bundles it. |
| `ATLAS_SHARED_COMMONJS_EXPORTS_UNREADABLE` | Atlas could not read the exports of a CommonJS shared dependency.  | Reinstall the package, or skip it in the federation config.                                   |
| `ATLAS_FEDERATION_TSCONFIG_INVALID`        | The project `tsconfig` could not be read.                          | Fix the reported syntax error, then rebuild.                                                  |
| `ATLAS_FEDERATION_TYPESCRIPT_MISSING`      | React federation needs TypeScript to discover shared dependencies. | Add `typescript` to the project's `devDependencies`, reinstall, and rebuild.                  |

## Bootstrap loader errors

Raised in the browser by `atlas.loader.js` before the host client mounts. The page shows a startup error panel with the message, the suggested actions, and the code. These codes have no `ATLAS_` prefix. Any failure without its own code is shown as `ATLAS_BOOTSTRAP_FAILED`.

| Code                           | Meaning                                                                             | Typical fix                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ATLAS_BOOTSTRAP_FAILED`       | The page could not start, and the failure has no more specific code.                | Read the error details for the first failed URL or value.                                                  |
| `DEPLOYMENT_INVALID`           | The active host manifest for this host and environment is missing or invalid.       | Check the environment registry URL and deploy the host to this environment.                                |
| `CATALOG_INVALID`              | The host catalog does not name this host or contains invalid app manifests.         | Publish and deploy manifests compatible with this loader.                                                  |
| `HOST_MANIFEST_INVALID`        | The selected host manifest is wrong for this host or loader.                        | Republish the host client with a matching ID, an `entry` expose, and a compatible loader API range.        |
| `ARTIFACT_URL_REJECTED`        | An artifact URL is outside the approved registry origins, or is not HTTPS.          | Check the registry URLs in `atlas.runtime.json`. Serve local builds only from loopback.                    |
| `ARTIFACT_VERIFICATION_FAILED` | Downloaded bytes do not match the digest recorded in the registry.                  | Republish the artifact. Check that nothing rewrites files between storage and the browser.                 |
| `OVERRIDE_INVALID`             | A Columbus override is invalid.                                                     | Use **Clear overrides and reload**, then fix or disable the override in [Columbus](../guides/columbus.md). |
| `RESOURCE_UNAVAILABLE`         | A required file could not be downloaded.                                            | Open the failed URL, then fix the deployment, authentication, or CORS policy.                              |
| `HOST_REMOTE_INVALID`          | The host remote entry does not expose the entry or has invalid shared dependencies. | Rebuild and republish the host client.                                                                     |
| `MODULE_LOADER_UNAVAILABLE`    | `/es-module-shims.js` is not served next to the bootstrap page.                     | Deploy all files from `atlas bootstrap`.                                                                   |
| `HOST_MOUNT_FAILED`            | The page has no `#atlas-host-root`, or the host client does not export `mount`.     | Keep `#atlas-host-root` in the template, then rebuild and redeploy the bootstrap and host.                 |
| `BOOTSTRAP_TEMPLATE_INVALID`   | The bootstrap template lacks the root element or the loader script.                 | Keep `id="atlas-host-root"` and the `/atlas.loader.js` script in `atlas.bootstrap.html`.                   |

See [Bootstrap](../deploy/bootstrap.md) for the files and the host platform contract.

## Runtime errors

Raised in the browser by `@atlas/runtime` while the host starts, mounts apps, and loads widgets. Failures inside one app or widget stay inside that placement; the host shows its error UI with a retry action. The classes are exported from `@atlas/runtime`.

### Host startup

| Code                              | Meaning                                                                                                      | Typical fix                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `ATLAS_HOST_START_FAILED`         | The host could not start.                                                                                    | Check the first failed URL or value in the details, fix the deployment, and reload.                      |
| `ATLAS_HOST_RETRY_FAILED`         | A retry of host startup failed.                                                                              | Same as above.                                                                                           |
| `ATLAS_INVALID_RUNTIME_CONFIG`    | The runtime configuration is invalid.                                                                        | Correct the named field in `atlas.runtime.json`. See [Configuration](configuration.md#atlasruntimejson). |
| `ATLAS_CATALOG_HOST_MISMATCH`     | The catalog belongs to a different host than the one configured.                                             | Correct `hostId` in `atlas.runtime.json`, or deploy the right host.                                      |
| `ATLAS_INVALID_CATALOG_SELECTION` | The catalog selects more than one version of an app, or an incompatible one.                                 | Deploy one compatible version per app.                                                                   |
| `ATLAS_INVALID_OVERRIDE`          | A Columbus override is invalid.                                                                              | Correct or disable the override in Columbus, then reload.                                                |
| `ATLAS_REMOTE_TRUST_REJECTED`     | A remote URL, origin, or integrity value failed the trust check.                                             | Correct the manifest URL or integrity, then rebuild and republish the app.                               |
| `ATLAS_RESOURCE_HTTP_ERROR`       | A download returned an HTTP error status.                                                                    | Check that the URL is deployed and allows the host origin through CORS.                                  |
| `ATLAS_RESOURCE_LOAD_FAILED`      | A required resource failed after all retries. The message lists stage, app, version, resource, and attempts. | Check that the resource is reachable and correctly configured.                                           |
| `ATLAS_INVALID_TIMEOUT`           | A timeout value is not a positive integer.                                                                   | Set `resourcesTimeoutMs` to an integer greater than zero.                                                |
| `ATLAS_INVALID_RETRY_COUNT`       | A retry count is not a non-negative integer.                                                                 | Set `resourcesRetryCount` to zero or a positive integer.                                                 |
| `ATLAS_RETRY_STATE_INVALID`       | The retry loop ended without a result. This is an Atlas defect.                                              | Report it with the runtime events and the stack trace.                                                   |
| `ATLAS_ARTIFACT_ENTRY_MISSING`    | An artifact manifest lists no file for its `entryPath`.                                                      | Republish the artifact.                                                                                  |
| `ATLAS_INVALID_JSON`              | A JSON document failed schema validation (`AtlasValidationError`). The error lists each field.               | Correct every listed field, or regenerate the document, then retry.                                      |

### Apps, routes, and slots

| Code                                | Meaning                                                                                                                                       | Typical fix                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ATLAS_APP_LOAD_FAILED`             | An app could not be loaded.                                                                                                                   | Correct the app build or catalog entry, then use **Retry**.                                           |
| `ATLAS_APP_MOUNT_FAILED`            | An app failed while mounting.                                                                                                                 | Check the remote entry, federation metadata, and placement, then retry.                               |
| `ATLAS_APP_MOUNT_EXPORT_MISSING`    | The app's remote module does not export `mount(request)`.                                                                                     | Export the app entry from the configured federation expose, then rebuild and republish.               |
| `ATLAS_APP_MOUNT_TIMEOUT`           | Mount or readiness did not finish in time (15 seconds by default).                                                                            | Look for slow or hanging mount and ready handlers.                                                    |
| `ATLAS_APP_ROUTE_NOT_FOUND`         | `navigateTo(appId)` names an app with no route in this host.                                                                                  | Use the ID of an app that has a route in this host.                                                   |
| `ATLAS_DUPLICATE_ROUTE`             | Two apps claim the same route path in one host. The first one wins, and Atlas logs this error for the others. `npx atlas verify` fails on it. | Give the path to one app only, then rebuild and republish the other.                                  |
| `ATLAS_ROUTE_RECONCILIATION_FAILED` | Atlas could not update the active route.                                                                                                      | Check the route placement and the app mount lifecycle named in the details.                           |
| `ATLAS_SLOT_NAME_MISSING`           | A slot anchor has no name.                                                                                                                    | Pass `slotId` to every `AtlasSlot` or `<atlas-slot>`.                                                 |
| `ATLAS_HOST_PROVIDER_MISSING`       | A React host anchor is rendered outside `AtlasHostProvider`.                                                                                  | Render the anchors inside the host layout passed to `defineReactHost`, or inside `AtlasHostProvider`. |
| `ATLAS_SDK_NOT_READY`               | Angular host code injected the SDK before the host runtime started.                                                                           | Inject the SDK lazily, for example inside a handler or effect.                                        |
| `ATLAS_STYLE_TARGET_MISSING`        | A mount container is not attached to a document, so Atlas has nowhere to put styles.                                                          | Mount into an element that is in the document.                                                        |
| `ATLAS_STYLESHEET_LOAD_FAILED`      | An app stylesheet could not be loaded.                                                                                                        | Check that the stylesheet URL is deployed and allows the host origin through CORS.                    |
| `ATLAS_STYLESHEET_ADAPT_FAILED`     | Atlas could not adapt a stylesheet for the app's DOM isolation.                                                                               | Make sure the stylesheet and its CSS imports allow CORS from the host origin.                         |

### Widgets

| Code                                | Meaning                                                                                                  | Typical fix                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ATLAS_WIDGET_ID_INVALID`           | The widget ID is empty.                                                                                  | Pass the widget UUID.                                                              |
| `ATLAS_WIDGET_NOT_FOUND`            | No deployed app in this environment exports the widget.                                                  | Deploy the widget's owner app to this environment.                                 |
| `ATLAS_WIDGET_AMBIGUOUS`            | More than one app exports the same widget ID.                                                            | Give every exported widget a unique UUID.                                          |
| `ATLAS_WIDGET_RESOLVER_MISSING`     | The host has no widget resolver and does not know the widget.                                            | Start the host through `startHost`, `defineAngularHost`, or `defineReactHost`.     |
| `ATLAS_WIDGET_REMOTE_MISMATCH`      | The widget's remote entry does not match its owner app.                                                  | Republish the owner app.                                                           |
| `ATLAS_WIDGET_OWNER_UNTRUSTED`      | The widget's owner app is not in the host catalog.                                                       | Deploy the owner app to the environment, then reload.                              |
| `ATLAS_WIDGET_OWNER_MISMATCH`       | The widget's `ownerAppId` does not match the owner manifest.                                             | Correct the widget config and republish the owner app.                             |
| `ATLAS_WIDGET_MOUNT_EXPORT_MISSING` | The widget's remote module does not export `mount(request)`.                                             | Regenerate or correct the widget expose, then rebuild and republish the owner app. |
| `ATLAS_WIDGET_MOUNT_FAILED`         | The widget failed to mount. In React, the widget component throws `AtlasWidgetMountError` during render. | Check the widget ID and owner app. In React, wrap the widget in an error boundary. |
| `ATLAS_WIDGET_READINESS_TIMEOUT`    | A widget that called `waitUntilReady()` did not call the returned callback in time.                      | Call the callback after the widget renders.                                        |

## SDK errors

Raised in the browser by `@atlas/sdk`. `AtlasSdkError` and its subclasses `AtlasWidgetMountError` and `AtlasEventListenerError` are exported from `@atlas/sdk`, so you can check them with `instanceof`.

| Code                                | Meaning                                                                                                         | Typical fix                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ATLAS_SDK_CONTEXT_MISSING`         | `useAtlasSdk()` ran outside `AtlasSdkProvider`.                                                                 | Render the component inside an Atlas-mounted app or below `AtlasSdkProvider`.                                                 |
| `ATLAS_APP_CONTEXT_MISSING`         | An app-only API ran outside a mounted app, for example `useAppLoaded()` or `sdk.assetUrl()` in host code.       | Call it only from code that an Atlas app mount renders. Hosts use their own asset URLs.                                       |
| `ATLAS_STYLE_TARGET_MISSING`        | `useAtlasStyleTarget()` ran outside a mounted app.                                                              | Call it only from a component rendered by the app mount.                                                                      |
| `ATLAS_ASSET_PATH_OUTSIDE_ARTIFACT` | `assetUrl(path)` points outside the app's artifact folder.                                                      | Pass a relative path such as `images/logo.svg`, without `..` or another origin.                                               |
| `ATLAS_EXTERNAL_SCOPED_NAVIGATION`  | App navigation received an absolute URL.                                                                        | Pass a same-origin path. Use the browser for external URLs.                                                                   |
| `ATLAS_HOST_NAVIGATION_NOT_READY`   | The SDK was created without host navigation.                                                                    | Create the SDK with `navigation` before starting the runtime.                                                                 |
| `ATLAS_ROUTE_RUNTIME_NOT_READY`     | `navigateTo` ran before the host route catalog was ready.                                                       | Wait until the host has started.                                                                                              |
| `ATLAS_WIDGET_RUNTIME_NOT_READY`    | `getWidget` resolved a widget before the host widget runtime was ready.                                         | Wait until the host has started.                                                                                              |
| `ATLAS_SDK_PROPERTY_CONFLICT`       | A custom host SDK property uses a reserved name.                                                                | Rename it so it does not collide with a core SDK member such as `hostId`, `hostData`, `navigateTo`, `events`, or `getWidget`. |
| `ATLAS_WIDGET_BINDING_INVALID`      | `[atlasWidget]` received a binding that `sdk.getWidget()` did not create.                                       | Create the binding with the injected Angular SDK.                                                                             |
| `ATLAS_WIDGET_MOUNT_FAILED`         | `AtlasWidgetMountError`: a React widget failed to mount.                                                        | Wrap the widget in an error boundary; check that the owner app is deployed.                                                   |
| `ATLAS_EVENT_LISTENER_FAILED`       | `AtlasEventListenerError`: an event listener threw. Atlas reports it asynchronously; other listeners still run. | Fix the listener named in the stack trace.                                                                                    |

## Related

- [Troubleshooting](../troubleshooting.md)
- [CLI reference](cli.md)
- [SDK reference](sdk.md)
- [Bootstrap](../deploy/bootstrap.md)
