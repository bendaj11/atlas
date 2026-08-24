# @atlas/bootstrap

Static Atlas browser bootstrap assets. Usually consumed through:

```sh
atlas bootstrap customer-host --registry-url https://assets.example.com/atlas
```

Output contains reusable `index.html`, browser loader files,
`atlas.bootstrap.json`, and static `nginx.conf`. The bootstrap stores only the
stable public registry root. `atlas deploy --host-url` creates Atlas-managed
host discovery so one image can serve different environments without startup
environment variables. Product teams customize HTML with `--template`; the
template must retain `atlas-host-root` and `/atlas.loader.js`.

Library consumers may call `createAtlasBootstrapFiles()` directly. No Express or
application server required.
