---
title: CLI reference
description: Every Atlas CLI command, flag, environment variable, and exit behavior, with defaults.
---

# CLI reference

This page lists every command in the Atlas command-line interface (`@atlas/cli`), every flag each command reads, and the environment variables that change CLI behavior. Use it when you need an exact flag name or default. For step-by-step instructions, start with the [tutorial](../get-started/tutorial.md).

## Install and run

Install the CLI as a development dependency in the folder that contains your host and apps:

```sh
npm install --save-dev --save-exact @atlas/cli
```

Run every command through `npx` so that the locally installed version is used:

```sh
npx atlas <command> [arguments] [options]
```

The CLI requires Node.js `^22.12.0` or `^24.0.0`. See [Compatibility](compatibility.md) for framework versions.

## Command summary

| Command                             | Purpose                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------- |
| [`generate`, `g`](#generate)        | Generate a host, an app, or an exported widget.                         |
| [`dev`](#dev)                       | Run a host locally, or run one app locally inside a host.               |
| [`compile-config`](#compile-config) | Compile a project's `atlas.config.ts` to `.atlas/atlas.config.js`.      |
| [`bootstrap`](#bootstrap)           | Create the static bootstrap files that load a deployed host.            |
| [`publish`](#publish)               | Publish existing build output as an immutable release or preview.       |
| [`deploy`](#deploy)                 | Select one published release for one environment.                       |
| [`remove-preview`](#remove-preview) | Remove one pull request or merge request preview.                       |
| [`prune-previews`](#prune-previews) | Remove previews that are no longer open.                                |
| [`verify`](#verify)                 | Check a deployed host, its active host manifest, artifacts, and assets. |
| [`version`](#global-options)        | Print the installed CLI version.                                        |
| [`help`](#global-options)           | Print help for the CLI or for one command.                              |

## Global options

| Option            | Description                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `-h`, `--help`    | Print help. Combine it with a command, for example `npx atlas deploy --help`.                |
| `-v`, `--version` | Print the installed CLI version. `npx atlas version` does the same.                          |
| `--no-input`      | Disable interactive prompts. Missing values then use their non-interactive defaults or fail. |

`npx atlas help <command>` prints the same help as `npx atlas <command> --help`. For `generate`, you can ask for a resource type, for example `npx atlas help generate app`.

The version flag works only on its own: `npx atlas --version` prints the version, but `npx atlas --version deploy` does not.

### Flag syntax

- Pass a value either as `--name value` or as `--name=value`.
- Boolean flags are on when present, for example `--dry-run`.
- A flag that expects a value takes the next token as that value, even when the next token is another flag. A flag at the end of the command line is read as the string `true`. Commands that need a URL or path reject that value.
- `--routing` expects a value. Write `--routing true`, `--routing=true`, or `--no-routing`. A bare `--routing` followed by another flag fails with `--routing must be true or false.`

### Interactive prompts

The CLI prompts for missing values only when all of the following are true:

- Standard input is a terminal (TTY).
- The `CI` environment variable is not set.
- You did not pass `--no-input`.

Otherwise, the CLI runs non-interactively. Each option below states what happens when its value is missing in non-interactive mode.

## generate

Generate a host, an app, or an exported widget. `g` is an alias for `generate`.

```sh
npx atlas generate <type> [name-or-path] [options]
npx atlas g <type> [name-or-path] [options]
```

| Argument       | Description                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `type`         | `host`, `app`, or `widget`. Prompted when omitted in interactive mode.                                             |
| `name-or-path` | Project name, or a path relative to the current directory such as `apps/admin-host`. Prompted in interactive mode. |

In non-interactive mode, `npx atlas g` without a name prints the `generate` help and exits successfully.

Path segments may contain letters, numbers, dots, underscores, and hyphens. Atlas IDs follow stricter rules; see [Generator errors](errors.md#generator-errors).

### generate host and generate app

```sh
npx atlas g host <name-or-path> [options]
npx atlas g app <name-or-path> [options]
```

| Option                                    | Type    | Default                                         | Description                                                                                                                     |
| ----------------------------------------- | ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--framework <name>`                      | string  | Prompted; `react` in non-interactive mode       | `angular` or `react`.                                                                                                           |
| `--host-id <uuid>`                        | string  | None                                            | App only. The host ID used for the generated route. `--host` is rejected; use `--host-id`.                                      |
| `--routing <true\|false>`, `--no-routing` | boolean | Prompted; routing on in non-interactive mode    | App only. `true` creates sample inner routes; `false` or `--no-routing` creates a single-page app. Hosts always route.          |
| `--style <format>`                        | string  | Prompted; `css` in non-interactive mode         | Angular only. `css`, `scss`, `sass`, or `less`.                                                                                 |
| `--port <number>`                         | integer | Next unused port from 4200 (host) or 4201 (app) | Dev-server port written to the project. Prompted in interactive mode.                                                           |
| `--framework-version <range>`             | string  | The version Atlas tests                         | Angular or React version or range for new packages. In an existing Nx workspace, Atlas keeps the workspace's framework version. |
| `--allow-unsupported-version`             | boolean | Off                                             | Generate with a framework major version that Atlas has not verified, using the nearest verified companion versions.             |
| `--directory <path>`                      | string  | Chosen from the workspace layout                | Target directory for the project.                                                                                               |
| `--force`                                 | boolean | Off                                             | Write into a target directory that already exists.                                                                              |
| `--skip-install`                          | boolean | Off                                             | Write files without installing dependencies.                                                                                    |
| `--skip-format`                           | boolean | Off                                             | Do not run the workspace formatter on generated files.                                                                          |
| `--skip-workspace-generator`              | boolean | Off                                             | Nx only. Skip the native Nx project generator and write Atlas files directly.                                                   |
| `--yes`                                   | boolean | Off                                             | Nx only. Approve installing a missing Nx plugin. In non-interactive mode, generation fails without it when a plugin is missing. |

After generation, the CLI installs dependencies with the detected package manager unless you pass `--skip-install`. It then formats the generated files: in an Nx workspace it runs `nx format:write` when Nx formatting is available; otherwise it runs the project's `format` script if one exists.

If generation fails and the target directory did not exist before, Atlas removes the partially generated directory.

```sh
npx atlas g host shop-host --framework react
npx atlas g app orders --framework angular --host-id 0a17281f-287b-4d89-a8ca-0ab0e577c506 --style scss
```

For what each generator creates, see [React generators](../guides/react/generators.md) and [Angular generators](../guides/angular/generators.md). For workspace detection, see [Workspaces and CI](../guides/workspaces-and-ci.md).

### generate widget

Generate an exported widget inside an existing app.

```sh
npx atlas g widget <name> [--app-id <uuid>] [options]
```

| Option            | Type    | Default                           | Description                                                           |
| ----------------- | ------- | --------------------------------- | --------------------------------------------------------------------- |
| `--app-id <uuid>` | string  | Prompted from the configured apps | ID of the app that owns the widget. Required in non-interactive mode. |
| `--force`         | boolean | Off                               | Replace an existing widget with the same name.                        |
| `--skip-format`   | boolean | Off                               | Do not run the workspace formatter on generated files.                |

See [Exported widgets](../guides/exported-widgets.md).

## dev

Run a host locally, or run one app locally inside a host.

```sh
npx atlas dev [project] [options]
```

| Argument  | Description                                                         |
| --------- | ------------------------------------------------------------------- |
| `project` | Atlas project name or directory. Defaults to the current directory. |

| Option                        | Type    | Default                                                                       | Description                                                                                        |
| ----------------------------- | ------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `--port <number>`             | integer | The project's configured dev-server port; otherwise 4200 (host) or 4201 (app) | For a host, the browser port. For an app, the framework dev-server port.                           |
| `--bootstrap-port <number>`   | integer | The host port                                                                 | Host only. Port of the local bootstrap page.                                                       |
| `--host-client-port <number>` | integer | 4300                                                                          | Host only. Internal port of the host framework dev server. Must differ from the bootstrap port.    |
| `--control-port <number>`     | integer | 4400                                                                          | Port of the local Atlas control server that serves overrides to [Columbus](../guides/columbus.md). |
| `--registry-url <url>`        | string  | `ATLAS_REGISTRY_URL`                                                          | Published artifact registry used for the host catalog and for the versions Columbus offers.        |
| `--environment <name>`        | string  | `production`                                                                  | Environment whose active host manifest the control server reads from that registry.                |
| `--no-open`                   | boolean | Off                                                                           | Do not open the browser automatically.                                                             |
| `--prepare-only`              | boolean | Off                                                                           | Write the local override document without starting development servers.                            |
| `--entry <path>`              | string  | `remoteEntry.json`                                                            | App only. Remote entry file name inside the build output.                                          |

`atlas dev` compiles `atlas.config.ts` before it starts. To run an app, add the `atlas.previews` array to the app's `package.json`:

```json
{
  "atlas": {
    "previews": ["http://localhost:4200"]
  }
}
```

Each entry must be an absolute HTTP or HTTPS URL of a host page. With one entry, Atlas uses it. With several entries, Atlas asks you to choose; in non-interactive mode it fails. `--host-url` is not supported. See [Local development](../guides/local-development.md).

`atlas dev` waits up to 120 seconds for the framework dev server to serve the remote entry. If it does not, the command fails with [`ATLAS_DEV_SERVER_TIMEOUT`](errors.md#cli-errors).

## compile-config

Compile a project's `atlas.config.ts` into `.atlas/atlas.config.js` inside the project.

```sh
npx atlas compile-config [project]
```

`project` is an Atlas project name or directory and defaults to the current directory. `dev`, `bootstrap`, and `publish` compile the config automatically. You need this command only for workspace targets such as `atlas:config`, or before you run a command with `--skip-compile`.

## bootstrap

Create the static files that load a deployed host: `index.html`, `atlas.loader.js`, and `es-module-shims.js`. The command does not create a server configuration or `atlas.runtime.json`; see [Bootstrap](../deploy/bootstrap.md).

```sh
npx atlas bootstrap <host> [options]
```

| Option                  | Type    | Default                            | Description                                                                               |
| ----------------------- | ------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `--out <path>`          | string  | `<host>/dist/bootstrap`            | Output directory. Atlas deletes and recreates it on every run.                            |
| `--template <path>`     | string  | `atlas.bootstrap.html` in the host | Host-relative HTML template to use instead of `atlas.bootstrap.html`.                     |
| `--title <text>`        | string  | None                               | Document title. Used when no template file is present.                                    |
| `--loading-html <html>` | string  | None                               | Loading markup. Used when no template file is present.                                    |
| `--skip-compile`        | boolean | Off                                | Use the already compiled `.atlas/atlas.config.js` instead of compiling `atlas.config.ts`. |

The command fails if the project is an app. On success, it prints the output directory and a `sha256:` digest of the generated files.

## publish

Publish existing build output as one immutable release or one preview. `publish` does not run your framework build, so build the project first.

```sh
npx atlas publish <project> (--version <version> | --pr <number> | --mr <number>) [options]
```

Pass exactly one of `--version`, `--pr`, or `--mr`.

| Option                                  | Type    | Default              | Description                                                                                 |
| --------------------------------------- | ------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `--version <version>`                   | string  | None                 | Release version. Atlas treats it as an opaque, immutable value.                             |
| `--pr <number>`, `--mr <number>`        | integer | None                 | Publish a preview for this pull request or merge request number. The two flags are aliases. |
| `--git-sha <sha>`                       | string  | `git rev-parse HEAD` | Commit recorded in the manifest. Previews require a commit SHA.                             |
| `--git-branch <name>`                   | string  | Current Git branch   | Branch recorded in the manifest.                                                            |
| `--git-commit-title <text>`             | string  | Last commit subject  | Commit title recorded in the manifest.                                                      |
| `--entry <path>`                        | string  | `remoteEntry.json`   | Remote entry file name that Atlas looks for to find the build output.                       |
| `--registry-url <url>`                  | string  | `ATLAS_REGISTRY_URL` | Public (browser-readable) registry root. HTTPS is required except on loopback.              |
| `--registry-config <path>`              | string  | `atlas.registry.ts`  | Registry config file. See [Registry config file](#registry-config-file).                    |
| `--parallel-uploads <count>`            | integer | 16                   | Parallel storage requests.                                                                  |
| `--expected-registry-revision <digest>` | string  | None                 | Fail unless `registry.json` currently has this revision.                                    |
| `--dry-run`                             | boolean | Off                  | Validate and list the files that would be written, without changing storage.                |
| `--skip-compile`                        | boolean | Off                  | Diagnostic. Use the already compiled Atlas config.                                          |
| [Storage options](#storage-options)     |         |                      | Select and configure the storage provider.                                                  |

Atlas looks for the build output in this order and uses the first directory that contains the remote entry: the workspace's configured output paths, `dist/apps/<project>`, `dist/apps/<id>`, `<project>/dist/<folder name>`, `<project>/dist/<id>`, and `<project>/dist`. For Angular projects, it also checks a `browser` subfolder of each. If nothing matches, the command fails with [`ATLAS_ARTIFACTS_MISSING`](errors.md#cli-errors).

For a preview, Atlas asks your Git provider whether the pull request is still open and whether the commit is still its head. See [PR previews](../guides/pr-previews.md) and [Git provider variables](#git-provider-variables).

```sh
npx atlas publish orders --version 1.4.0
npx atlas publish orders --pr 123
```

## deploy

Select one published release of one app or host for one environment. `deploy` does not need a workspace checkout, does not build, and does not copy artifact files. It writes `environments/<environment>/deployment.json` and the active host manifests. See [Registry](registry.md).

```sh
npx atlas deploy <artifact> --to <environment> --version <selector> [options]
```

| Argument   | Description                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `artifact` | Stable ID of the app or host, or its package or unique display name. Atlas matches the ID first. |

| Option                              | Type    | Default                     | Description                                                                                                         |
| ----------------------------------- | ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `--to <environment>`                | string  | None                        | Target environment name.                                                                                            |
| `--version <selector>`              | string  | None                        | An exact published version, `latest`, or the name of a source environment whose current selection you want to copy. |
| `--registry-url <url>`              | string  | `ATLAS_REGISTRY_URL`        | One registry used as both source and target.                                                                        |
| `--source-registry-url <url>`       | string  | `ATLAS_SOURCE_REGISTRY_URL` | Registry to read releases and environment selections from. Requires `--target-registry-url`.                        |
| `--target-registry-url <url>`       | string  | `ATLAS_TARGET_REGISTRY_URL` | Registry whose environment state you change. Requires `--source-registry-url`.                                      |
| `--registry-config <path>`          | string  | `atlas.registry.ts`         | Registry config file. Its `hostUrls` are verified after a successful deployment.                                    |
| `--parallel-uploads <count>`        | integer | 16                          | Parallel storage requests.                                                                                          |
| `--dry-run`                         | boolean | Off                         | Resolve and validate without writing.                                                                               |
| [Storage options](#storage-options) |         |                             | Select and configure the storage provider.                                                                          |

`deploy --help` also lists `--expected-registry-revision`, but `deploy` does not read it. Only `publish`, `remove-preview`, and `prune-previews` check the registry revision.

Pass either `--registry-url`, or both `--source-registry-url` and `--target-registry-url`. You cannot combine `--registry-url` with the source or target flags. Registry URLs must use HTTPS (loopback HTTP is allowed) and must not contain credentials, a query, or a hash.

```sh
npx atlas deploy orders --to production --version 1.4.0 \
  --registry-url https://assets.example.com/atlas

npx atlas deploy orders --to production --version staging \
  --source-registry-url https://staging.example.com/atlas \
  --target-registry-url https://production.example.com/atlas
```

## remove-preview

Remove one preview selection of one app or host.

```sh
npx atlas remove-preview <artifact> (--pr <number> | --mr <number>) [options]
```

Pass exactly one of `--pr` or `--mr`. The value must be a positive integer.

| Option                                  | Type   | Default              | Description                                           |
| --------------------------------------- | ------ | -------------------- | ----------------------------------------------------- |
| `--registry-url <url>`                  | string | `ATLAS_REGISTRY_URL` | Public registry root.                                 |
| `--registry-config <path>`              | string | `atlas.registry.ts`  | Registry config file.                                 |
| `--expected-registry-revision <digest>` | string | None                 | Fail unless the registry currently has this revision. |
| [Storage options](#storage-options)     |        |                      | Select and configure the storage provider.            |

## prune-previews

Remove preview selections whose pull requests are no longer open, and delete expired preview files.

```sh
npx atlas prune-previews --state-file <path> [options]
```

| Option                                  | Type   | Default              | Description                                               |
| --------------------------------------- | ------ | -------------------- | --------------------------------------------------------- |
| `--state-file <path>`                   | string | None (required)      | JSON file with the complete list of open preview numbers. |
| `--registry-url <url>`                  | string | `ATLAS_REGISTRY_URL` | Public registry root.                                     |
| `--registry-config <path>`              | string | `atlas.registry.ts`  | Registry config file.                                     |
| `--expected-registry-revision <digest>` | string | None                 | Fail unless the registry currently has this revision.     |
| [Storage options](#storage-options)     |        |                      | Select and configure the storage provider.                |

See [PR previews](../guides/pr-previews.md) for the state file format.

## verify

Check one or more deployed hosts. For each host, Atlas loads the page, its runtime config, and its active host manifest. It then checks remote entries, stylesheets, integrity, CORS, cache and MIME headers, and federation metadata, and prints one line per check.

```sh
npx atlas verify --host-url <url> [options]
```

| Option               | Type   | Default           | Description                                           |
| -------------------- | ------ | ----------------- | ----------------------------------------------------- |
| `--host-url <url>`   | string | `ATLAS_HOST_URL`  | One deployed host page or base URL.                   |
| `--host-urls <urls>` | string | `ATLAS_HOST_URLS` | Several host URLs, separated by commas or whitespace. |

You can combine both flags; Atlas removes duplicates. The command fails if no URL is given or if any check fails.

```sh
npx atlas verify --host-url https://shop.example.com
```

## Storage options

`publish`, `deploy`, `remove-preview`, and `prune-previews` write to a storage provider. Atlas supports S3-compatible storage and JFrog Artifactory. Flags override the matching environment variables.

| Option                        | Environment variable              | Description                                                                                 |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `--storage <s3\|artifactory>` | `ATLAS_STORAGE`                   | Storage provider. Setting a bucket without a provider selects `s3`.                         |
| `--storage-api-url <url>`     | `ATLAS_STORAGE_API_URL`           | Private S3-compatible endpoint or Artifactory API root.                                     |
| `--bucket <name>`             | `ATLAS_S3_BUCKET`                 | S3 bucket. Required for S3.                                                                 |
| `--key-prefix <prefix>`       | `ATLAS_STORAGE_KEY_PREFIX`        | Key prefix inside the bucket or repository. Artifactory defaults to `atlas`.                |
| `--region <region>`           | `ATLAS_S3_REGION`                 | S3 signing region. Falls back to `AWS_REGION`, then `AWS_DEFAULT_REGION`, then `us-east-1`. |
| `--repository <name>`         | `ATLAS_ARTIFACTORY_REPOSITORY`    | Artifactory local Generic repository.                                                       |
| `--lock-resource <name>`      | `ATLAS_ARTIFACTORY_LOCK_RESOURCE` | Name of the shared external writer lock for Artifactory.                                    |

If no provider is configured through flags, environment variables, or `atlas.registry.ts`, the command fails with [`ATLAS_STORAGE_NOT_CONFIGURED`](errors.md#cli-errors). For Artifactory setup and its Jenkins lock, see [Artifactory](../deploy/artifactory.md).

## Registry config file

`atlas.registry.ts` is optional. `publish`, `deploy`, `remove-preview`, and `prune-previews` load it from the current directory, or from the path you pass with `--registry-config`. If you pass `--registry-config` and the file does not exist, the command fails. The file must default-export an object; `defineAtlasRegistryConfig` from `@atlas/cli` types it:

```ts
import { defineAtlasRegistryConfig } from '@atlas/cli';

export default defineAtlasRegistryConfig({
  hostUrls: ['https://shop.example.com'],
});
```

| Field                | Description                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| `storage`            | A custom storage implementation (`AtlasPublicationStorage`), such as a configured `S3PublicationStorage`. |
| `invalidate`         | Called with the changed paths after a write, for example to purge a CDN.                                  |
| `hostUrls`           | Hosts that `deploy` verifies after a successful deployment.                                               |
| `resolvePreviewHead` | Custom lookup of a pull request's state and head commit.                                                  |
| `verifyRegistry`     | Custom check of the published `registry.json`. When set, `publish` does not require `--registry-url`.     |

## Environment variables

Flags always win over environment variables. Variables that are already set in the shell win over values from `.env` files.

### `.env` files

- `generate`, `bootstrap`, `publish`, and `compile-config` load `.env.local` and then `.env` from the workspace root.
- `dev` loads `.env.local` and `.env` from the project directory, then from the workspace root.
- `deploy`, `remove-preview`, `prune-previews`, and `verify` do not load `.env` files. Set their variables in the environment.

Because the first value wins, `.env.local` overrides `.env`, and project files override workspace files. Atlas reads `NAME=value` lines, ignores comments and blank lines, accepts an optional `export` prefix, and strips matching single or double quotes.

### Registry and deployment

| Variable                    | Used by                                                        | Description                                                                                        |
| --------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ATLAS_REGISTRY_URL`        | `publish`, `deploy`, `remove-preview`, `prune-previews`, `dev` | Default for `--registry-url`.                                                                      |
| `ATLAS_SOURCE_REGISTRY_URL` | `deploy`                                                       | Default for `--source-registry-url`.                                                               |
| `ATLAS_TARGET_REGISTRY_URL` | `deploy`                                                       | Default for `--target-registry-url`. Artifactory deployments also use it as the public target URL. |
| `ATLAS_HOST_URL`            | `verify`                                                       | Default for `--host-url`.                                                                          |
| `ATLAS_HOST_URLS`           | `verify`                                                       | Default for `--host-urls`. Separated by commas or whitespace.                                      |
| `ATLAS_PARALLEL_UPLOADS`    | Storage commands                                               | Default for `--parallel-uploads`. Positive integer.                                                |

### S3 storage

| Variable                          | Description                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ATLAS_STORAGE`                   | `s3` or `artifactory`.                                                                                                                                             |
| `ATLAS_STORAGE_API_URL`           | S3-compatible endpoint. Omit it for AWS S3.                                                                                                                        |
| `ATLAS_S3_BUCKET`                 | Bucket name.                                                                                                                                                       |
| `ATLAS_STORAGE_KEY_PREFIX`        | Key prefix.                                                                                                                                                        |
| `ATLAS_S3_REGION`                 | Signing region.                                                                                                                                                    |
| `ATLAS_S3_FORCE_PATH_STYLE`       | `true` or `false`. Use path-style bucket URLs, which many S3-compatible servers need.                                                                              |
| `ATLAS_S3_LOCK_MODE`              | `s3` (default) or `external`. With `s3`, Atlas holds a lock object at `.atlas/deployment.lock`. Use `external` only when your pipeline already serializes writers. |
| `ATLAS_STORAGE_ACCESS_KEY_ID`     | Access key ID. Set it together with `ATLAS_STORAGE_SECRET_ACCESS_KEY`.                                                                                             |
| `ATLAS_STORAGE_SECRET_ACCESS_KEY` | Secret access key.                                                                                                                                                 |
| `ATLAS_STORAGE_SESSION_TOKEN`     | Optional session token for temporary credentials.                                                                                                                  |

Without the access key variables, the AWS SDK default credential chain applies. There are no credential flags.

### Artifactory storage

| Variable                               | Description                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ATLAS_ARTIFACTORY_REPOSITORY`         | Local Generic repository.                                                                                      |
| `ATLAS_ARTIFACTORY_ACCESS_TOKEN`       | Access token. Environment only; there is no flag.                                                              |
| `ATLAS_ARTIFACTORY_LOCK_RESOURCE`      | Name of the shared external lock.                                                                              |
| `ATLAS_PUBLICATION_LOCK`               | Set by the Jenkins `lock` step. Must equal the lock resource name. Setting it by hand does not acquire a lock. |
| `ATLAS_ARTIFACTORY_REQUEST_TIMEOUT_MS` | Request timeout in milliseconds. Default `60000`.                                                              |
| `ATLAS_ARTIFACTORY_MAX_BUFFERED_BYTES` | Per-object buffer limit in bytes. Default `268435456`.                                                         |

### Git provider variables

Preview publication checks the live state of the pull request. Atlas detects the provider from these variables:

| Provider  | Detected by                                     | Token                                         |
| --------- | ----------------------------------------------- | --------------------------------------------- |
| GitHub    | `GITHUB_REPOSITORY` (`GITHUB_API_URL` optional) | `ATLAS_GIT_TOKEN` or `GITHUB_TOKEN`           |
| GitLab    | `CI_PROJECT_ID` and `CI_API_V4_URL`             | `ATLAS_GIT_TOKEN` (optional)                  |
| Bitbucket | `BITBUCKET_REPO_FULL_NAME`                      | `ATLAS_GIT_TOKEN` or `BITBUCKET_ACCESS_TOKEN` |

To replace this lookup, set `resolvePreviewHead` in `atlas.registry.ts`.

### Local manifest metadata

These values affect only the local app manifest that `atlas dev` builds:

| Variable            | Description                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| `ATLAS_CREATED_AT`  | ISO 8601 timestamp used as the manifest `createdAt`.                   |
| `SOURCE_DATE_EPOCH` | Seconds since the Unix epoch. Used when `ATLAS_CREATED_AT` is not set. |

### Terminal output

| Variable    | Description                                        |
| ----------- | -------------------------------------------------- |
| `NO_COLOR`  | Disable ANSI colors.                               |
| `TERM=dumb` | Disable colors and animated progress.              |
| `CI`        | Disable interactive prompts and animated progress. |

> **Note:** The CLI source also parses `--channel`, `--pr-number`, `--build-id`, `--environment-registry-url`, `ATLAS_CHANNEL`, `ATLAS_ENVIRONMENT`, and `ATLAS_ENVIRONMENT_REGISTRY_URL`. No current command uses them to change published output: `atlas dev` always builds a `local` channel manifest, and your platform, not the CLI, writes `atlas.runtime.json`. Do not rely on them.

## Output and exit status

- Progress, results, and success messages go to standard output. Warnings and errors go to standard error.
- A successful command exits with status `0`.
- Any failure exits with status `1`. The CLI prints the error summary, numbered suggested actions, and each underlying cause. Failures carry a stable code such as `ATLAS_PROJECT_NOT_FOUND`; unclassified failures use `ATLAS_CLI_FAILURE`. See [Errors](errors.md).
- An unknown command fails with `ATLAS_UNKNOWN_COMMAND`.

## Related

- [Configuration reference](configuration.md)
- [Registry reference](registry.md)
- [Errors](errors.md)
- [Local development](../guides/local-development.md)
- [Production deployment](../deploy/production-deployment.md)
