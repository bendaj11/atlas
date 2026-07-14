# @atlas/runtime

Host-side discovery, loading, routing, and lifecycle orchestration for Atlas apps.

Audience: generated host clients and platform maintainers. Feature apps should
use `@atlas/sdk`, not import runtime directly.

```sh
# Choose one:
npm install @atlas/runtime
pnpm add @atlas/runtime
yarn add @atlas/runtime
```

Framework adapters are available from `@atlas/runtime/react` and `@atlas/runtime/angular`.

Generated hosts call `startHost` through those adapters. Runtime reads already
validated catalog/runtime input, enforces trust/integrity, mounts selected apps,
and isolates loading failures. Start with [Architecture](https://github.com/bendaj11/atlas/blob/main/docs/architecture.md);
use [Public API](https://github.com/bendaj11/atlas/blob/main/docs/api.md) only
when customizing generated infrastructure.
