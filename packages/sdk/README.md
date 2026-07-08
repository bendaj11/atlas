# @atlas/sdk

Typed host capabilities and framework adapters for Atlas microfrontends.

```sh
# Choose one:
npm install @atlas/sdk
pnpm add @atlas/sdk
yarn add @atlas/sdk
```

Use `@atlas/sdk/react` or `@atlas/sdk/angular` for framework integration.

Atlas exports a default fetch-backed HTTP client:

```ts
import { HttpClient } from "@atlas/sdk";

const httpClient = new HttpClient();
await httpClient.get("/api/orders");
```

Hosts can omit `httpClient` in `startHost` to use this default, or provide a
custom `AtlasHttpClient` when they need axios, authentication, interceptors, or
another transport.
