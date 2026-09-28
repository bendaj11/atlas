# @atlas/runtime

Host infrastructure for Atlas. It loads the active deployment, applies local overrides, checks integrity, loads apps through Native Federation, and mounts them into the host's route outlet and slots. Hosts use it; apps use `@atlas/sdk` instead.

## Install

The `@atlas` packages are not on the public npm registry. Point the `@atlas` scope at your organization's registry in `.npmrc` first. Generated hosts already depend on this package; to add it by hand:

```sh
npm install @atlas/runtime
```

## Example

A generated React host exports its `mount` entry from `src/bootstrap.tsx`. This excerpt omits its style and polyfill imports:

```tsx
import { createRoot } from 'react-dom/client';
import { defineReactHost } from '@atlas/runtime/react';
import atlasConfig from '../atlas.config';
import { HostLayout } from './host-layout';
import {
  HostProviders,
  useCustomHostSdkOptions,
  type CustomerHostSdk,
} from './host.config';

export const mount = defineReactHost<CustomerHostSdk>({
  config: atlasConfig,
  layout: HostLayout,
  reactDom: { createRoot },
  providers: HostProviders,
  useSdkOptions: useCustomHostSdkOptions,
});
```

Angular hosts use `defineAngularHost()` from `@atlas/runtime/angular`.

## Entry points

`@atlas/runtime`, `@atlas/runtime/react`, and `@atlas/runtime/angular`.

## Documentation

- [Public API](https://github.com/bendaj11/atlas/blob/main/docs/reference/api.md#atlasruntime)
- [Host anchors](https://github.com/bendaj11/atlas/blob/main/docs/concepts/host-anchors.md)
- [Architecture](https://github.com/bendaj11/atlas/blob/main/docs/introduction/architecture.md)
- [Errors](https://github.com/bendaj11/atlas/blob/main/docs/reference/errors.md#runtime-errors)
