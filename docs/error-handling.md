# Atlas error handling

Atlas errors must help someone who does not know Atlas internals understand what
failed and what to do next. Every public error boundary wraps failures in
`AtlasError`; foreign errors remain available through `cause`.

## Error contract

`AtlasError` exposes:

| Field | Meaning |
| --- | --- |
| `summary` | Plain-language description of the failed Atlas operation |
| `suggestedActions` | One or more concrete recovery steps |
| `surface` | `cli`, `browser`, or `universal` |
| `code` | Stable Atlas failure category |
| `cause` | Original error and stack trace |
| `message` | Summary plus formatted suggested actions |

Never mutate a caught error. Never expose a foreign error without naming the
Atlas operation that failed. Never replace the cause or stack trace with only a
friendly string.

## Surface rules

### CLI

- Name the command and failed subject.
- Preserve option, file, URL, HTTP status, or provider details.
- Suggest exact flags, files, permissions, storage settings, or commands.
- `atlas --help` is appropriate only for an unknown command or invalid command
  shape. It is not a recovery step for build, deployment, or runtime failures.
- Print summaries and numbered actions to stderr; exit non-zero.

### Browser runtime and SDK

- Name the host, app, widget, route, overlay, or resource.
- Actions must be possible from browser/deployment context: correct a URL,
  manifest, CORS policy, host layout, catalog, or deployed build; then retry or
  reload.
- Never recommend terminal help.
- Console errors use structured objects containing message, actions, code, and
  cause.
- User-visible fatal panels display actions separately from technical details.

### Columbus

- Wrap Chrome API and inspected-page errors with the Columbus operation.
- Tell users which host/App Preview tab to activate, which override to correct,
  or when to reload and reopen Columbus.

## Boundary ownership

| Boundary | Responsibility |
| --- | --- |
| `packages/cli/src/cli-error.ts` | Command-aware CLI classification |
| `packages/bootstrap/src/browser-loader.ts` | Static bootstrap fatal panel and console report |
| `packages/runtime/src/browser-error.ts` | Structured runtime console reports |
| `packages/runtime/src/index.ts` | App, route, and widget lifecycle failures |
| `packages/sdk/src/sdk-error.ts` | Public SDK misuse and unavailable capabilities |
| `apps/columbus/.../atlas-host.ts` | Chrome/inspection failures shown by Columbus |

Internal validation functions may throw focused errors. Their nearest public
boundary must add Atlas context and recovery before logging, rendering, or
returning the failure.

## Writing an error

Good:

```text
Atlas could not load app "orders": https://cdn.example/orders/remoteEntry.json returned HTTP 404.
Suggested actions:
1. Verify the app remote entry is deployed at the catalog URL.
2. Correct and republish the app manifest, then use Retry in the page.
```

Bad:

```text
Failed to fetch.
Suggested action: Run atlas --help.
```

Suggested actions must change the failing condition. “Retry,” “check the
configuration,” or “contact support” alone are not sufficient.

## Standards references

- [Command Line Interface Guidelines](https://clig.dev/) — rewrite expected
  failures for humans, suggest what to do next, keep diagnostics on stderr, and
  preserve useful output when commands are piped.
- [GNU diagnostic conventions](https://www.gnu.org/prep/standards/html_node/Errors.html)
  — keep non-interactive diagnostics consistent and identify the relevant
  program, file, and location when available.
- [Node.js error documentation](https://nodejs.org/api/errors.html) — retain the
  original failure through `Error.cause` when Atlas adds operation context.
