# Security

Atlas loads JavaScript selected by remote metadata. Treat the static registry
and app publication pipeline as part of the application's code supply chain.

## Runtime Guarantees

For production, PR, and historical manifests Atlas:

1. validates the manifest shape;
2. permits HTTP(S) remote entries only;
3. loads the exact remote-entry and stylesheet URLs selected by the host catalog;
4. verifies optional `sha256-...` metadata when a manifest provides it.

Trust checks are isolated per app. Atlas never initializes a rejected remote,
but other trusted apps continue to run and the host renders its normal fallback
UI in the rejected app's route or slot.

Local manifests are exempt from origin and integrity requirements because
`atlas dev` intentionally loads a changing loopback build. Their remote entry,
stylesheet, and exported-widget URLs must resolve to localhost or an IP loopback
address. URL and storage app overrides are enabled by default and can be disabled
with `allowAppOverrides: false` in runtime configuration or host options.
Override documents still have to target the current host and contain matching
app ids. Catalog placements and supported-host declarations remain authoritative,
and Atlas revalidates widget dependencies after applying replacements.

## Host Configuration

```json
{
  "schemaVersion": "1",
  "hostId": "customer-host",
  "catalogUrl": "https://registry.example.com/atlas/hosts/customer-host/catalog.json",
  "allowAppOverrides": false,
  "resourcesTimeoutMs": 15000,
  "resourcesRetryCount": 3
}
```

`allowAppOverrides` controls Atlas tooling that swaps selected app manifests at
runtime. Keep it `false` in production unless a controlled environment explicitly
needs PR, historical, or local overrides. `resourcesTimeoutMs` and
`resourcesRetryCount` bound Atlas-owned catalog, override, federation, app load,
and readiness work.

## Storage And CI Requirements

- Allow publication only from protected CI identities.
- Upload immutable assets before publishing manifests and catalogs.
- Never overwrite an existing version/build path.
- Use HTTPS for production storage.
- Restrict CORS to known host origins where operationally practical.
- Revalidate mutable catalogs while caching versioned assets as immutable.
- Use registry revision checks or storage locking for concurrent publications.
- Keep cloud and package-registry credentials out of source and generated files.

## Content Security Policy

The host's CSP must allow scripts and connections from every approved asset
origin. Atlas does not weaken or inject CSP headers because the host and
deployment platform own them.

## Trust Boundary

Anyone who can publish both an asset and its manifest is effectively a code
publisher for the host. Protect publication permissions, review app changes, and
preserve an auditable build-to-manifest relationship.

Atlas does not place apps in cross-origin iframes. apps share the host page and
can access browser APIs available to that page. DOM boundaries and Shadow DOM
help with UI and style isolation, not security isolation.

## Dependency Checks

Run the package manager's dependency audit and your organization's secret/SAST
scanners in consumer CI. Atlas keeps these tools consumer-selectable because
organizations differ in vulnerability feeds, policies, and accepted scanners.
The Atlas release pipeline verifies exact package tarballs and publishes SHA-256
checksums so downstream publishing does not need to rebuild them.
