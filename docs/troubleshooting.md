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

## Host APIs Are Missing

MFs should depend only on `AtlasSdk`. If a needed capability is missing, add it to the SDK contract rather than importing host internals.

### The host spinner never disappears

When the host has `waitForMfReady: true`, the MF must call `context.ready()` after its first useful render. Generated projects already do this. If it called `context.loading.show()`, readiness also removes that loader. Atlas eventually times out, unmounts the incomplete MF, and presents the host fallback with Retry.

### An event is not received by another MF

Subscribe before the publisher emits, keep the returned unsubscribe function for teardown, and confirm both MFs are mounted in the same host page. Atlas events are live in-memory notifications; they are not replayed to MFs mounted later.
