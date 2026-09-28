---
title: Error handling
description: Learn how Atlas errors are structured, where they are created, and how to write an error that tells the reader what to do next.
---

# Error handling

This page explains how Atlas reports failures in the CLI, the browser runtime, the SDK, and Columbus. It is for contributors who add or change an error, and its goal is that someone who does not know Atlas internals can understand what failed and what to do next.

## Error contract

Every public error boundary reports failures as an `AtlasError`, which is defined in `packages/schema/src/errors/atlas-error/atlas-error.ts`. Errors from other libraries stay available through `cause`.

| Field              | Meaning                                                         |
| ------------------ | --------------------------------------------------------------- |
| `summary`          | A plain-language description of the Atlas operation that failed |
| `suggestedActions` | One or more concrete recovery steps                             |
| `surface`          | `cli`, `browser`, or `universal` (the default)                  |
| `code`             | An optional, stable Atlas failure category                      |
| `cause`            | The original error and its stack trace                          |
| `message`          | The summary followed by the formatted suggested actions         |

When the constructor receives no suggested action, it uses a generic default. Always pass a specific action instead. Use `ensureActionableError()` from `@atlas/schema` to wrap an unknown failure without losing its cause.

Never mutate a caught error. Never expose a foreign error without naming the Atlas operation that failed. Never replace the cause or the stack trace with a friendly string alone.

## Surface rules

### CLI

- Name the command and the subject that failed.
- Preserve the option, file, URL, HTTP status, or provider details.
- Suggest exact flags, files, permissions, storage settings, or commands.
- Recommend `npx atlas --help` only for an unknown command or an invalid command shape. It is not a recovery step for build, deployment, or runtime failures.
- Print the summary and the actions to stderr, and exit with a non-zero status.

The CLI converts any failure that reaches the command boundary with `normalizeToCliError()`. An error that is already a CLI `AtlasError` passes through unchanged. A `universal` `AtlasError` keeps its summary and actions and becomes a CLI error. Any other failure becomes an `AtlasError` with the code `ATLAS_CLI_FAILURE`, a summary such as `Atlas publish failed: ...`, and actions inferred from the message. [CLI output](cli-output.md#errors) shows how the result is printed.

### Browser runtime and SDK

- Name the Host, App, widget, route, overlay, or resource.
- Suggest actions that are possible from the browser or the deployment: correct a URL, a manifest, a CORS policy, a host layout, an environment selection, or a deployed release, and then retry or reload.
- Never recommend terminal help.
- Log console errors as structured objects that contain the message, the suggested actions, the code, and the cause.
- On user-visible fatal panels, show the suggested actions separately from the technical details.

### Columbus

- Name the Columbus operation when you wrap a Chrome API error or an error from the inspected page.
- Tell users which host or app preview tab to activate, which override to correct, or when to reload the page and reopen Columbus.

## Boundary ownership

Each boundary below adds Atlas context and recovery steps before it logs, renders, or returns a failure.

| Boundary                                         | Responsibility                                                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `packages/cli/src/shared/cli-error/cli-error.ts` | `CliError` and command-aware classification of CLI failures                                                      |
| `packages/bootstrap/src/shared/errors/`          | Bootstrap error codes and suggested actions                                                                      |
| `packages/bootstrap/src/browser/fatal-error/`    | The static bootstrap fatal panel and its console report                                                          |
| `packages/runtime/src/shared/errors.ts`          | `AtlasRuntimeError`, `AtlasBrowserError`, and structured console reports through `logBrowserError()`             |
| `packages/runtime/src/host-runtime/`             | App, route, and widget lifecycle failures                                                                        |
| `packages/sdk/src/core/sdk-error/sdk-error.ts`   | `AtlasSdkError` and its subclasses for SDK misuse and unavailable capabilities                                   |
| `apps/columbus/src/utils/`                       | Chrome API and page inspection failures shown by Columbus, for example in `host-tabs/` and `inspect-atlas-host/` |

Internal validation functions may throw focused errors. The nearest public boundary must add Atlas context and a recovery step before the failure reaches a user.

## Write an error

A good error names the subject, keeps the technical detail, and gives actions that change the failing condition:

```text
Atlas could not load app "orders": https://cdn.example/orders/remoteEntry.json returned HTTP 404.
Suggested actions:
1. Verify the app remote entry is present at the URL referenced by the active host manifest.
2. Correct and republish the app manifest, then use Retry in the page.
```

A poor error hides the subject and gives an action that cannot fix the problem:

```text
Failed to fetch.
Suggested action: Run atlas --help.
```

"Retry", "check the configuration", or "contact support" on their own are not sufficient suggested actions.

## Standards references

- [Command Line Interface Guidelines](https://clig.dev/) recommend rewriting expected failures for humans, suggesting what to do next, keeping diagnostics on stderr, and preserving useful output when commands are piped.
- [GNU diagnostic conventions](https://www.gnu.org/prep/standards/html_node/Errors.html) describe consistent non-interactive diagnostics that identify the program, the file, and the location when available.
- [Node.js error documentation](https://nodejs.org/api/errors.html) explains how `Error.cause` keeps the original failure when Atlas adds operation context.

## Related

- [CLI output](cli-output.md)
- [Documentation guide](documentation-guide.md)
