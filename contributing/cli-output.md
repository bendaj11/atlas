---
title: CLI output
description: Learn the output, prompt, and color rules that every Atlas CLI command follows.
---

# CLI output

This page defines how Atlas CLI commands write to the terminal. It is for contributors who add or change a command in `packages/cli`, and it describes the contract that both people and automation rely on.

## Use the shared UI module

Every command prints human-facing status through the shared `ui` object and prompts through `TerminalPrompter`, both in `packages/cli/src/shared/ui/ui.ts`. Command modules must not write status lines with `console` directly, because the shared module owns the markers, the output streams, the spinner, and color handling.

## Output contract

Each `ui` method prints one kind of line:

| Method                                  | Marker       | Stream | Use                                          |
| --------------------------------------- | ------------ | ------ | -------------------------------------------- |
| `ui.heading(message)`                   | `Atlas ·`    | stdout | The command and its current target           |
| `ui.info(message)`                      | `i`          | stdout | Progress, decisions, and next steps          |
| `ui.success(message)`                   | `✓`          | stdout | A completed operation                        |
| `ui.warning(message)`                   | `WARN` badge | stderr | A recoverable problem or a degraded result   |
| `ui.error(message)`                     | `✖`          | stderr | A failed operation and its suggested actions |
| `ui.item(message)`                      | `•`          | stdout | One member of a result list                  |
| `ui.result(label, value)`               | `<label>:`   | stdout | A value that users may copy or pipe          |
| `ui.linkedResult(label, value, target)` | `<label>:`   | stdout | A result that is also a terminal hyperlink   |

Long-running commands such as `publish` and `deploy` report steps through `ui.progress`. In an interactive terminal, the running step is an animated spinner line that updates in place, for example `Uploading files 23/68 (4.2 MB)`. When the step completes, a success line replaces the spinner line. Steps that take one second or longer show their duration, for example `✓ Uploaded 68 files (4.2 MB) · 3.1s`. When stdout is not a TTY, when `CI` is set, or when `TERM=dumb`, each step prints one `i` line when it starts and one `✓` line when it completes, without animation.

## Write status messages

Write status messages in plain language that does not require knowledge of Atlas internals. Follow these rules:

- Print one event per line, and make the first sentence self-contained.
- Put the most important result last, unless a labeled result must be followed by a next step.
- Do not end a status line with `...`, and do not put a period directly after a URL.
- Do not add timestamps, because CI systems and log collectors add their own.

## Errors

`ui.error()` splits an error message into a summary line and its suggested actions. When a command fails with an error that is not already a CLI error, `normalizeToCliError()` in `packages/cli/src/shared/cli-error/cli-error.ts` builds the summary with `formatCliSummary()` and picks suggested actions that match the message.

`formatCliSummary()` prefixes the summary with `Atlas <command> failed: `, or with `Atlas CLI failed: ` when no command is known. It leaves the summary unchanged when it already starts with `Atlas`, `--`, `ATLAS_`, `Unknown help topic`, or `Unknown or incomplete command`, so messages never read "Atlas publish failed: Atlas ...".

A message that does not start with one of those prefixes gets the command prefix:

```text
✖ Atlas publish failed: Could not find tsconfig.app.json or tsconfig.json in /work/apps/orders.
  Suggested actions:
    1. Restore the named file or pass an existing Atlas project or path.
    2. Rerun `atlas publish` after correcting the condition.
```

A message that already starts with `Atlas` is printed as it is:

```text
✖ Atlas project "orders" is missing required configuration file "apps/orders/atlas.config.ts".
  Suggested actions:
    1. Restore the named file or pass an existing Atlas project or path.
    2. Rerun `atlas publish` after correcting the condition.
```

An error with one action prints it on a single `Suggested action:` line. An error with several actions prints them as a numbered list under `Suggested actions:`. Expected failures name the failed subject, explain the condition, and give a concrete recovery action. Stack traces stay available to developers through the error `cause`, but they are not part of normal CLI output. See [error handling](error-handling.md) for the rules that apply across the CLI, the browser runtime, and Columbus.

## Command headings

The following commands print a heading when they start. Commands that are not listed print no heading.

| Command                         | Heading                                           | Primary completion output                                                                  |
| ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `generate host`, `generate app` | `Generate host · <name>`, `Generate app · <name>` | The created project paths                                                                  |
| `generate widget`               | `Generate widget · <name>`                        | The created widget                                                                         |
| `dev`                           | `Develop · <project>`                             | The Atlas logo before the heading, then an `App preview` link                              |
| `bootstrap`                     | `Bootstrap · <host>`                              | The output directory, a `Bootstrap digest` result, and the files to deploy                 |
| `publish`                       | `Publish · <project>`                             | A `Manifest` result with the published manifest path                                       |
| `deploy`                        | `Deploy · <artifact>`                             | The deployed version and environment, then host verification when host URLs are configured |
| `verify`                        | `Verify deployment`                               | The checks, followed by the number of verified deployments                                 |

`remove-preview`, `prune-previews`, and `compile-config` print only a success or information line. `help` and `version` print only the requested content.

## Prompts

The CLI prompts only when stdin is a TTY, `CI` is unset, and the `--no-input` flag is absent. Follow these rules when you add a prompt:

- Ask only for missing values. Explicit flags always win.
- Use sentence case, name the requested value, and show the default in brackets.
- Use clear affirmative and negative labels for choices.
- On invalid input, explain what is accepted and let the user try again.
- Keep Ctrl+C as an immediate way out.
- In non-interactive mode, fail with a message that names the flag or environment variable that supplies the missing value.

## Color and accessibility

Color reinforces markers but never carries meaning on its own. The shared UI module disables ANSI color when the stream is not a TTY, when `TERM=dumb`, or when `NO_COLOR` is set. Warnings and errors still go to stderr when color is off.

## Design references

- [Command Line Interface Guidelines](https://clig.dev/) cover discoverability, stdout and stderr separation, actionable errors, TTY-aware prompts, and `--no-input`.
- [NO_COLOR](https://no-color.org/) describes user-controlled ANSI color.
- [The Twelve-Factor App: Logs](https://12factor.net/logs) explains event-stream logging and why routing and storage belong to the execution environment.

## Related

- [Error handling](error-handling.md)
- [Testing](testing.md)
