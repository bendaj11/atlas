# Host bootstrap

Atlas bootstrap is a small static host shell. Atlas generates exactly two files:

```text
index.html
atlas.loader.js
```

Platform/IaC owns a third same-origin file, `atlas.runtime.json`. Atlas never
generates or edits it.

```json
{
  "schemaVersion": "v1",
  "hostId": "27a27fea-5a2c-4ed8-bd31-6e56613932bb",
  "environment": "production",
  "artifactRegistryUrl": "https://assets.example.com/atlas",
  "environmentRegistryUrl": "https://deployments.example.com/atlas"
}
```

`environmentRegistryUrl` is optional and defaults to `artifactRegistryUrl`.
The file contains no secrets. Serve it with HTTPS and revalidation or
`no-cache`.

## Build bootstrap

```bash
pnpm exec atlas bootstrap customer-host
```

Use `--template` to customize `index.html`. Template must retain
`atlas-host-root` and `/atlas.loader.js`.

## Browser flow

1. Browser loads `index.html` and `atlas.loader.js` from host origin.
2. Loader reads `/atlas.runtime.json` from same origin.
3. Loader reads active host manifest from:

   ```text
   <environmentRegistryUrl>/environments/<environment>/hosts/<hostId>/manifest.json
   ```

4. Loader resolves selected host and app descriptors against
   `artifactRegistryUrl`.
5. Loader verifies and mounts immutable artifact payloads.

One host origin maps to one environment. Changing host domain does not require
Atlas deploy: platform/IaC writes runtime config for that host.

## Platform requirements

- Serve host shell and runtime config same-origin over HTTPS.
- Own SPA fallback, routing, CSP, and response headers.
- Allow artifact and environment registry origins in CSP.
- Configure CORS on both registries for host origin.
- Cache immutable artifacts indefinitely; revalidate environment state and
  runtime config.

`atlas verify` validates runtime config, registries, artifact integrity, CORS,
and CSP requirements.
