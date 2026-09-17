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

## Package layout

| Subpath                        | Contents                                                               |
| ------------------------------ | ---------------------------------------------------------------------- |
| `@atlas/sdk`                   | Host SDK factory, events, host data, lifecycle contracts, navigation   |
| `@atlas/sdk/host`              | `createAtlasSdk`, event bus, host-data updates (host-only)             |
| `@atlas/sdk/lifecycle`         | Mount contracts for hosts, apps, and exported widgets                  |
| `@atlas/sdk/navigation`        | Browser, scoped, and route-context navigation primitives               |
| `@atlas/sdk/react`             | `useAtlasSdk`, `defineApp`, `createRoutedApp`, widget components       |
| `@atlas/sdk/angular`           | `injectAtlasSdk`, `provideAtlasApp`, `WidgetOutlet`, location strategy |
| `@atlas/sdk/federation`        | Native Federation runtime re-export                                    |
| `@atlas/sdk/federation-config` | Typed Vite and Native Federation config factories for builds           |

Every public failure is an `AtlasError` with a stable `code` and
`suggestedActions`; see [error handling](https://github.com/bendaj11/atlas/blob/main/docs/error-handling.md).
