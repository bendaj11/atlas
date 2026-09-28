# @atlas/sdk

The Atlas SDK. Apps and exported widgets use it to read host data, send events, navigate to other Apps, and render Widgets. It also contains the React and Angular App adapters and the build-time federation config.

## Install

The `@atlas` packages are not on the public npm registry. Get them from your organization's registry or build them from source; see [Get the packages](https://github.com/bendaj11/atlas/blob/main/docs/reference/compatibility.md#get-the-packages). Generated Hosts and Apps already depend on this package; to add it by hand:

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

Angular Apps use `injectAtlasSdk()` from `@atlas/sdk/angular` instead.

## Entry points

`@atlas/sdk`, `@atlas/sdk/host`, `@atlas/sdk/lifecycle`, `@atlas/sdk/navigation`, `@atlas/sdk/react`, `@atlas/sdk/angular`, `@atlas/sdk/federation`, and `@atlas/sdk/federation-config`.

## Documentation

- [SDK reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/sdk.md)
- [Public API reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/api.md)
- [Share host data with Apps](https://github.com/bendaj11/atlas/blob/main/docs/guides/host-data.md)
- [Errors reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/errors.md)
