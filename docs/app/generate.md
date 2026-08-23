# Generate an Atlas App

Create an Angular or React feature App that Atlas can show inside a Host. Use a
Host ID to create an initial URL, or omit it when you will add the URL later.

## Quick Start

Run this command from the workspace root after copying the Host ID from
`atlas.config.ts`:

```sh
atlas g app orders --framework=react --host-id=<customer-host-id>
```

**Expected result:** Atlas creates feature source files, `atlas.config.ts`, and
an initial URL for the supplied Host.

> [!tip]
> Use `atlas g app orders --framework=react` when you will add URLs or page
> areas after generation.

## Common Scenarios

### Generate Angular App With Inner Routing

```sh
atlas g app orders --framework=angular --host-id=<customer-host-id> --routing
```

### Generate a Single-Page App

```sh
atlas g app orders --framework=react --no-routing
```

### Generate Into Monorepo Directory

```sh
atlas g app billing --framework=react --directory=apps/billing
```

> [!warning]
> `--host-id` is the unique ID in the Host's `atlas.config.ts`; it is not the
> Host project name or URL. Changing it disconnects the App from that Host.

## Command Reference

Syntax:

```text
atlas generate app <name-or-path> [options]
```

| Parameter                     | Type                                | Required | Description                                                                   | Default                    |
| ----------------------------- | ----------------------------------- | -------- | ----------------------------------------------------------------------------- | -------------------------- |
| `<name-or-path>`              | string                              | No       | App name or command-relative path. Prompts when omitted.                      | Prompted                   |
| `--framework <name>`          | `angular` \| `react`                | No       | Framework for generated project.                                              | Prompted                   |
| `--host-id <host-id>`         | UUID                                | No       | Stable host ID for generated route.                                           | No placement               |
| `--routing`, `--no-routing`   | boolean                             | No       | Create inner route files or single-page app.                                  | Prompted interactively     |
| `--style <format>`            | `css` \| `scss` \| `sass` \| `less` | No       | Angular stylesheet format.                                                    | Prompted interactively     |
| `--port <number>`             | number                              | No       | App development-server port.                                                  | Next free port from `4201` |
| `--framework-version <range>` | semver range                        | No       | Framework version for new package. Existing Nx projects keep installed major. | Atlas default              |
| `--directory <path>`          | relative path                       | No       | Directory where Atlas creates app.                                            | Derived from name          |
| `--allow-unsupported-version` | boolean                             | No       | Generate outside Atlas tested framework range.                                | `false`                    |
| `--force`                     | boolean                             | No       | Permit writing into existing target directory.                                | `false`                    |
| `--skip-install`              | boolean                             | No       | Create files without dependency installation.                                 | `false`                    |
| `--skip-workspace-generator`  | boolean                             | No       | Skip native Nx project generator.                                             | `false`                    |
| `--yes`                       | boolean                             | No       | Approve required workspace plugin installation.                               | `false`                    |
| `-h`, `--help`                | boolean                             | No       | Print current CLI help.                                                       | `false`                    |

## Generated Project

Atlas creates framework files, `atlas.config.ts`, a file Atlas calls to start
the App, and build and publish commands. Edit feature UI, styles, tests, URLs,
and App configuration. Do not import Host source code; use the SDK for shared
Host services.

Next: [build Angular App](../angular/app-getting-started.md) or [build React
App](../react/app-getting-started.md).
