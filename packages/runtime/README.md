# @atlas/runtime

Host infrastructure for Atlas. It loads the active deployment, applies local overrides, checks integrity, loads Apps through Native Federation, and mounts them into the Host's route outlet and slots. Hosts use it; Apps use `@atlas/sdk` instead.

## Install

The `@atlas` packages are not on the public npm registry. Get them from your organization's registry or build them from source; see [Get the packages](https://github.com/bendaj11/atlas/blob/main/docs/reference/compatibility.md#get-the-packages). Generated Hosts already depend on this package; to add it by hand:

```sh
npm install @atlas/runtime
```

## Example

A generated React Host exports its `mount` entry from `src/bootstrap.tsx`. This excerpt omits its style and polyfill imports:

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

Angular Hosts use `defineAngularHost()` from `@atlas/runtime/angular`.

## Entry points

`@atlas/runtime`, `@atlas/runtime/react`, and `@atlas/runtime/angular`.

## Documentation

- [Public API reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/api.md#atlasruntime)
- [Host anchors](https://github.com/bendaj11/atlas/blob/main/docs/concepts/host-anchors.md)
- [Architecture](https://github.com/bendaj11/atlas/blob/main/docs/introduction/architecture.md)
- [Errors reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/errors.md#runtime-errors)
