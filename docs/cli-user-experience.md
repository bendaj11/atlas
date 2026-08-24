# Atlas CLI user experience

Atlas CLI is a text user interface for both people and automation. Every command
uses the shared presentation and prompting APIs in `packages/cli/src/ui.ts`.
Command modules must not print human-facing status directly.

## Output contract

| Kind        | Marker     | Stream | Use                                    |
| ----------- | ---------- | ------ | -------------------------------------- |
| Heading     | `Atlas ·`  | stdout | Command and current target             |
| Information | `i`        | stdout | Progress, decisions, and next steps    |
| Success     | `✓`        | stdout | Completed operation                    |
| Warning     | `!`        | stderr | Recoverable problem or degraded result |
| Error       | `✖`        | stderr | Failed operation                       |
| Item        | `•`        | stdout | A member of a result list              |
| Result      | `<label>:` | stdout | A value users may copy or pipe         |

Use one event per line. Keep the first sentence self-contained. Put the most
important result last unless a labeled result must be followed by a next step.
Do not add timestamps: CI and log collectors own timestamps.

Errors use this shape:

```text
✖ Could not build "orders".
  Suggested action: Correct atlas.config.ts, then rerun atlas build orders.
```

Expected failures should name the failed subject, explain the condition, and
give a concrete recovery action. Stack traces remain available to developers
through the underlying error; they are not normal CLI output.

Cross-environment rules: [Atlas error handling](./error-handling.md).

## Command inventory

| Command           | Heading                      | Primary completion                           |
| ----------------- | ---------------------------- | -------------------------------------------- |
| `generate host`   | `Generate host · <name>`     | Created project paths                        |
| `generate app`    | `Generate app · <name>`      | Created project paths                        |
| `generate widget` | `Generate widget · <name>`   | Created widget                               |
| `dev`             | `Develop · <project>`        | Labeled app preview URL                      |
| `build`           | `Build · <project>`          | Built artifact identity                      |
| `bootstrap`       | `Bootstrap · <host>`         | Output path and bootstrap digest             |
| `publish`         | `Publish · <project>`        | Published immutable manifest                 |
| `deploy`          | `Deploy · <artifact>`        | Selected release and host convergence        |
| `remove-preview`  | `Remove preview · #<number>` | Removed selection                            |
| `prune-previews`  | `Prune previews`             | Checked selections and expired generations   |
| `verify`          | `Verify deployment`          | Checks followed by verified deployment count |
| `compile-config`  | none; workspace-internal     | Compiled project configuration               |
| `help`, `version` | none                         | Plain requested content                      |

## Prompts

- Prompt only when stdin and stdout are TTYs and `CI` is unset.
- `--no-input` always disables prompts.
- Ask only for missing values; explicit flags always win.
- Use sentence case, name the requested value, and show defaults in brackets.
- Use clear affirmative and negative choice labels.
- On invalid input, explain the accepted range and let the user retry.
- Ctrl+C must remain an immediate escape path.
- Non-interactive missing input must fail with the flag or environment variable
  that supplies it.

## Color and accessibility

Color reinforces markers but never carries meaning alone. Disable ANSI color
when output is not a TTY, `TERM=dumb`, or `NO_COLOR` is set. Warnings and errors
use their own streams even without color.

## Design references

- [Command Line Interface Guidelines](https://clig.dev/) for discoverability,
  stdout/stderr separation, actionable errors, TTY-aware prompts, and
  `--no-input`.
- [NO_COLOR](https://no-color.org/) for user-controlled ANSI color.
- [The Twelve-Factor App: Logs](https://12factor.net/logs) for event-stream
  logging and leaving routing and storage to the execution environment.
