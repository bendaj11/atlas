# @atlas/schema

TypeScript types and validators for Atlas configuration, manifests, registries, and the Host runtime config. You use its types in `atlas.config.ts`; the Atlas CLI generates the manifests.

## Install

The `@atlas` packages are not on the public npm registry. Get them from your organization's registry or build them from source; see [Get the packages](https://github.com/bendaj11/atlas/blob/main/docs/reference/compatibility.md#get-the-packages). Generated Hosts and Apps already depend on this package; to add it by hand:

```sh
npm install @atlas/schema
```

## Example

```ts
import type { AtlasAppConfig } from '@atlas/schema';

export default {
  type: 'app',
  id: '7f3c2a8e-6d1b-4e59-9a0c-2b8d4f6e1a37',
  name: 'Orders',
  framework: 'react',
  routes: [{ hostId: '0a17281f-287b-4d89-a8ca-0ab0e577c506', path: '/orders' }],
} satisfies AtlasAppConfig;
```

## Documentation

- [Configuration reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/configuration.md)
- [Manifests reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/manifests.md)
- [Public API reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/api.md#atlasschema)
