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

1. `https://<host>/atlas.runtime.json` returns expected host ID and environment.
2. Its registry URLs are public roots, not private S3 APIs.
3. Environment host manifest is reachable through CORS.
4. Selected artifact manifests and payloads are reachable through CORS.

Update platform runtime config when host identity or environment is wrong. Do
not create runtime config from Atlas deploy.
