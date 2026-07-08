# Troubleshooting

Most Atlas problems become simpler when you first identify the domain:

- **Host domain:** shell layout, runtime config, catalog URL, DOM anchors,
  `startHost`, host SDK providers.
- **App domain:** app `atlas.config.ts`, lifecycle entry, inner routes, assets,
  feature code.
- **Deployment domain:** CDN files, CORS, MIME types, catalogs, registry,
  integrity, cache.

Pick the framework page for concrete fixes:

- [Angular troubleshooting](angular/troubleshooting.md)
- [React troubleshooting](react/troubleshooting.md)

Always run deployment verification before debugging browser symptoms in a
production-like environment:

```sh
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```
