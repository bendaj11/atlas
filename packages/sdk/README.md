# @atlas/sdk

The Atlas SDK. Apps and exported widgets use it to read host data, send events, navigate to other apps, and render widgets. It also contains the React and Angular app adapters and the build-time federation config.

## Install

The `@atlas` packages are not on the public npm registry. Point the `@atlas` scope at your organization's registry in `.npmrc` first. Generated hosts and apps already depend on this package; to add it by hand:

```sh
npm install @atlas/sdk
```

## Example

```tsx
import { useAtlasSdk } from '@atlas/sdk/react';

interface ShopHostSdk {
  readonly hostData: { readonly locale: string };
}

export function Locale() {
  const sdk = useAtlasSdk<ShopHostSdk>();

  return <p>{sdk.hostData.locale}</p>;
}
```

Angular apps use `injectAtlasSdk()` from `@atlas/sdk/angular` instead.

## Entry points

`@atlas/sdk`, `@atlas/sdk/host`, `@atlas/sdk/lifecycle`, `@atlas/sdk/navigation`, `@atlas/sdk/react`, `@atlas/sdk/angular`, `@atlas/sdk/federation`, and `@atlas/sdk/federation-config`.

## Documentation

- [SDK reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/sdk.md)
- [Public API](https://github.com/bendaj11/atlas/blob/main/docs/reference/api.md)
- [Share host data](https://github.com/bendaj11/atlas/blob/main/docs/guides/host-data.md)
- [Errors](https://github.com/bendaj11/atlas/blob/main/docs/reference/errors.md)
