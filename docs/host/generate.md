# Generate an Atlas Host

Create an Angular or React Host with the files Atlas needs to run it. Use this
command before building the main application layout, shared services, or startup
files for deployment.

## Quick Start

Run from workspace root:

```sh
atlas g host customer-host --framework=react
```

**Expected result:** Atlas creates a Host project, `atlas.config.ts`, framework
source files, and commands for building and publishing the project.

> [!tip]
> Use a clear name such as `customer-host`. The folder name can change later;
> Atlas uses the generated ID in `atlas.config.ts` to identify the Host.

## Common Scenarios

### Generate an Angular Host

```sh
atlas g host customer-host --framework=angular
```

### Generate a React Host in a Directory

```sh
atlas g host customer-host --framework=react --directory=apps/customer-host
```

### Generate Without Installing Dependencies

```sh
atlas g host customer-host --framework=react --skip-install
```

> [!warning]
> `--force` writes into existing target directory. Review that directory before
> using it; Atlas does not treat existing application files as disposable.

## Command Reference

Syntax:

```text
atlas generate host <name-or-path> [options]
```

| Parameter                     | Type                                | Required | Description                                                                   | Default                    |
| ----------------------------- | ----------------------------------- | -------- | ----------------------------------------------------------------------------- | -------------------------- |
| `<name-or-path>`              | string                              | No       | Host name or command-relative path. Prompts when omitted.                     | Prompted                   |
| `--framework <name>`          | `angular` \| `react`                | No       | Framework for generated project.                                              | Prompted                   |
| `--style <format>`            | `css` \| `scss` \| `sass` \| `less` | No       | Angular stylesheet format.                                                    | Prompted interactively     |
| `--port <number>`             | number                              | No       | Host development-server port.                                                 | Next free port from `4200` |
| `--framework-version <range>` | semver range                        | No       | Framework version for new package. Existing Nx projects keep installed major. | Atlas default              |
| `--directory <path>`          | relative path                       | No       | Directory where Atlas creates host.                                           | Derived from name          |
| `--allow-unsupported-version` | boolean                             | No       | Generate outside Atlas tested framework range.                                | `false`                    |
| `--force`                     | boolean                             | No       | Permit writing into existing target directory.                                | `false`                    |
| `--skip-install`              | boolean                             | No       | Create files without dependency installation.                                 | `false`                    |
| `--skip-workspace-generator`  | boolean                             | No       | Skip native Nx project generator.                                             | `false`                    |
| `--yes`                       | boolean                             | No       | Approve required workspace plugin installation.                               | `false`                    |
| `-h`, `--help`                | boolean                             | No       | Print current CLI help.                                                       | `false`                    |

## Generated Project

Atlas creates normal framework files, `atlas.config.ts`, build and publish
commands, and an HTML template used when the Host starts in a browser. Edit your
application code and configuration. Leave generated Atlas loading files in place
unless you are extending Atlas itself.

Next: [build Angular Host](../angular/host-getting-started.md) or [build React
Host](../react/host-getting-started.md).
