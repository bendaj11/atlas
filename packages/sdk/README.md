# @atlas/sdk

Typed host capabilities and framework adapters for Atlas apps.

Audience: app developers consuming host services and host developers providing
them. Choose `@atlas/sdk/react` or `@atlas/sdk/angular`; generated entries show
framework setup.

```sh
# Choose one:
npm install @atlas/sdk
pnpm add @atlas/sdk
yarn add @atlas/sdk
```

Use `@atlas/sdk/react` or `@atlas/sdk/angular` for framework integration.

Hosts define product-specific APIs, clients, and services in their typed SDK
extension. Atlas does not prescribe an HTTP client contract.

Apps should not create their own host SDK. Read it with `useAtlasSdk()` or
`injectAtlasSdk()`. Continue with [SDK guide](https://github.com/bendaj11/atlas/blob/main/docs/sdk.md).
