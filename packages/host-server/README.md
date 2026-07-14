# @atlas/host-server

Portable framework-neutral Atlas HTTP bootstrap server, browser loader, health endpoints, security headers, deep-link fallback, and recovery UI.

```sh
npm install @atlas/host-server

# Use host UUID from atlas.config.ts, not local folder name.
ATLAS_HOST_ID=0a17281f-287b-4d89-a8ca-0ab0e577c506 \
ATLAS_CATALOG_URL=https://cdn.example.com/atlas/hosts/0a17281f-287b-4d89-a8ca-0ab0e577c506/catalog.json \
npm exec -- atlas-host-server
```

Required values:

- `ATLAS_HOST_ID`: stable host UUID from `atlas.config.ts`.
- `ATLAS_CATALOG_URL`: absolute public URL ending in
  `hosts/<host-id>/catalog.json`.

Server listens on `PORT=8080` by default. Check `/health/live`,
`/health/ready`, and `/atlas.runtime.json`. Product UI is not copied into this
server; release host client separately with `atlas release <host-project>`.

See the [host-server documentation](https://github.com/bendaj11/atlas/blob/main/docs/host-server.md).
