# @atlas/bootstrap

Static Atlas browser bootstrap assets. Usually consumed through:

```sh
atlas build-bootstrap customer-host --registry-base-url https://cdn.example/atlas
```

Output contains `index.html`, `atlas.loader.js`, `atlas.runtime.json`, and
`nginx.conf`. Copy files into an Nginx image or equivalent static host. Product
teams customize HTML with `--template`; template must retain `atlas-host-root`
and `/atlas.loader.js`.

Library consumers may call `createAtlasBootstrapFiles()` directly. No Express or
application server required.
