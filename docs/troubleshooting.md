# Troubleshooting

Most Atlas problems become simpler when you first identify the domain:

- **Host domain:** shell layout, bootstrap metadata, discovery, active host manifest URL, DOM anchors,
  `startHost`, host SDK providers.
- **App domain:** app `atlas.config.ts`, lifecycle entry, inner routes, assets,
  feature code.
- **Deployment domain:** CDN files, CORS, MIME types, `registry.json`, active and
  canonical manifests, integrity, cache.

Pick the framework page for concrete fixes:

- [Angular troubleshooting](angular/troubleshooting.md)
- [React troubleshooting](react/troubleshooting.md)

Always run deployment verification before debugging browser symptoms in a
production-like environment:

```sh
atlas verify --host-url=https://customer.example
```

For deployment failures, check in this order:

1. `https://<host>/atlas.bootstrap.json` returns JSON and the expected host ID.
2. Its `registryUrl` is the public registry root, not the private S3 API.
3. `<registry>/hosts/<host-id>/discovery.json` is reachable through CORS.
4. One discovery `baseUrl` matches the URL open in the browser.
5. The selected `manifestUrl` returns the intended environment manifest.

Run the host deploy again with `--host-url` if discovery has no correct binding.
Do not create or edit discovery by hand.
