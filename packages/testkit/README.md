# @atlas/testkit

Test helpers for Atlas Hosts and Apps: a mock Atlas environment for unit tests, memory navigation, and manifest builders. Install it as a development dependency; never ship it in a production bundle.

## Install

The `@atlas` packages are not on the public npm registry. Get them from your organization's registry or build them from source; see [Get the packages](https://github.com/bendaj11/atlas/blob/main/docs/reference/compatibility.md#get-the-packages). Then install:

```sh
npm install --save-dev --save-exact @atlas/testkit
```

## Entry points

| Entry point              | Use                                                                 |
| ------------------------ | ------------------------------------------------------------------- |
| `@atlas/testkit`         | `mockAtlasEnvironment`, `createMemoryNavigation`, manifest builders |
| `@atlas/testkit/react`   | `MockAtlasEnvironmentProvider` for React tests                      |
| `@atlas/testkit/angular` | `provideMockAtlasEnvironment` for Angular tests                     |

## Documentation

- [Testing Apps and Hosts](https://github.com/bendaj11/atlas/blob/main/docs/guides/testing-apps-and-hosts.md)
- [Public API reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/api.md#atlastestkit)
