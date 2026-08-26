# @atlas/bootstrap

Static Atlas browser bootstrap assets. Usually consumed through:

```sh
atlas bootstrap customer-host
```

Output contains reusable `index.html` and `atlas.loader.js`. Platform/IaC owns
same-origin `atlas.runtime.json`, which selects host ID, environment, artifact
registry, and optional environment registry. Product teams customize HTML with
`--template`; the template must retain `atlas-host-root` and `/atlas.loader.js`.

Library consumers may call `createAtlasBootstrapFiles()` directly. No Express or
application server required.
