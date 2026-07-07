# Troubleshooting

## The MF Does Not Load

Check:

- the host catalog URL is reachable
- the manifest validates
- `remoteEntryUrl` points to a deployed asset
- the MF exposes an `entry` module with `mount`

## The Wrong Version Loaded

Check:

- Chrome extension overrides
- manifest channel
- host-specific catalog
- duplicate MF ids in a catalog

Atlas should fail if a catalog selects multiple versions of the same MF id.

## Inner Routing Escapes The MF

Use `context.navigation.navigate("child-route")` instead of directly calling `history.pushState`.

The SDK scopes relative navigation under the MF base path.

## Angular Remote Entry Does Not Load

Verify that `remoteEntryUrl` points to `remoteEntry.json`, not a JavaScript file, and that the CDN serves every file from the Angular `dist/<project>/browser` directory with CORS enabled. Atlas passes this URL to Native Federation and loads `./entry` by expose name.

If an exposed entry is reported as missing from compilation, ensure `tsconfig.app.json` includes `src/**/*.ts`.

## Install Fails With Angular Or React Peer Conflicts

An `ERESOLVE unable to resolve dependency tree` error usually means the package
manifest has mixed framework majors, such as `@angular/core@21` with
`@angular/animations@20`, or `react@17` with `react-dom@18`.

In Nx workspaces, Atlas reads the manifest that owns the generated project. If
that manifest already declares `@angular/core` or `react`, Atlas keeps that
version and aligns framework companion dependencies to it. The CLI prints a
detected-version message and warns if `--framework-version` was ignored to avoid
upgrading the whole monorepo.

If peer conflicts still appear:

- Remove stale mismatched entries from the owning `package.json` and rerun Atlas.
- Upgrade or downgrade the workspace framework packages first, then rerun Atlas.
- Generate a package with its own framework version if your Nx layout supports project-level `package.json` files.
- Use `--skip-workspace-generator` for a portable Atlas-generated package, or `--skip-install` when another tool owns dependency resolution.

## Host APIs Are Missing

MFs should depend only on `AtlasSdk`. If a needed capability is missing, add it to the SDK contract rather than importing host internals.

### The host spinner never disappears

When the host has `waitForMfReady: true`, the MF must call `context.ready()` after its first useful render. Generated projects already do this. If it called `context.loading.show()`, readiness also removes that loader. Atlas eventually times out, unmounts the incomplete MF, and presents the host fallback with Retry.

### An event is not received by another MF

Subscribe before the publisher emits, keep the returned unsubscribe function for teardown, and confirm both MFs are mounted in the same host page. Atlas events are live in-memory notifications; they are not replayed to MFs mounted later.
