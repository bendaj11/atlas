# @atlas/testkit

Test helpers for Atlas hosts and apps: a mock Atlas environment for unit tests, memory navigation, and manifest builders. Install it as a development dependency; never ship it in a production bundle.

## Install

The `@atlas` packages are not on the public npm registry. Point the `@atlas` scope at your organization's registry in `.npmrc` first, then install:

```sh
npm install --save-dev @atlas/testkit
```

## Entry points

| Entry point              | Use                                                                 |
| ------------------------ | ------------------------------------------------------------------- |
| `@atlas/testkit`         | `mockAtlasEnvironment`, `createMemoryNavigation`, manifest builders |
| `@atlas/testkit/react`   | `MockAtlasEnvironmentProvider` for React tests                      |
| `@atlas/testkit/angular` | `provideMockAtlasEnvironment` for Angular tests                     |

## Documentation

- [Testing apps and hosts](https://github.com/bendaj11/atlas/blob/main/docs/guides/testing-apps-and-hosts.md)
- [Public API](https://github.com/bendaj11/atlas/blob/main/docs/reference/api.md#atlastestkit)
