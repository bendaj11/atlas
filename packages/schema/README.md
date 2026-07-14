# @atlas/schema

TypeScript schemas and validation for Atlas manifests, catalogs, registries, and runtime configuration.

Audience: config authors, tooling, and operators. Product developers normally
write typed `atlas.config.ts`; Atlas CLI generates manifest/catalog JSON.

```sh
# Choose one:
npm install @atlas/schema
pnpm add @atlas/schema
yarn add @atlas/schema
```

See the [schema documentation](https://github.com/bendaj11/atlas/blob/main/docs/manifest.md) for supported schemas.

Use `AtlasHostConfig` or `AtlasAppConfig` for source config. Use manifest and
catalog validators only at infrastructure boundaries; never hand-edit generated
deployment JSON.
