# @atlas/testkit

Fixtures and in-memory utilities for testing Atlas hosts, manifests, and apps.

Audience: host/app test authors. Install as development dependency; never ship
testkit in production bundle.

```sh
# Choose one:
npm install --save-dev @atlas/testkit
pnpm add --save-dev @atlas/testkit
yarn add --dev @atlas/testkit
```

Use `mockAtlasEnvironment` for app unit tests, with
`provideMockAtlasEnvironment` from `@atlas/testkit/angular` or
`MockAtlasEnvironmentProvider` from `@atlas/testkit/react`. Use `anAppManifest`
for host mount tests. These replace host/runtime boundary, not framework component test
tools. See [Consumer testing](https://github.com/bendaj11/atlas/blob/main/docs/consumer-testing.md).
