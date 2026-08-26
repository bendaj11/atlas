# Atlas App

An Atlas App is a feature shown inside a Host, such as Orders or Billing. Build
one when your team owns that feature. An App declares where it appears, uses
services supplied by the Host through the SDK, and does not import Host code.

## Build an App

1. [Generate an App](app/generate.md).
2. Choose [Angular](angular/app-getting-started.md) or [React](react/app-getting-started.md).
3. Declare the URL or page area where it appears in `atlas.config.ts`.
4. Declare development host pages in `package.json` `atlas.previews`, then run
   it inside a Host with [local development](local-development.md#configure-app-previews).

## Build The App

| Need                                          | Read                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Generate Angular or React App                 | [Generate an App](app/generate.md)                                                          |
| Build UI and choose where it appears          | [Angular App](angular/app-getting-started.md) / [React App](react/app-getting-started.md)   |
| Own inner routes and navigate to another app  | [Angular routing](angular/routing.md) / [React routing](react/routing.md)                   |
| Use HTTP, host data, events, product services | [Angular SDK](angular/sdk.md) / [React SDK](react/sdk.md)                                   |
| Add assets and keep styles isolated           | [Angular assets](angular/assets-and-styles.md) / [React assets](react/assets-and-styles.md) |
| Export reusable UI                            | [Exported widgets](exported-widgets.md)                                                     |
| Verify app-host contracts                     | [Consumer testing](consumer-testing.md)                                                     |

## Ship The App

| Need                                      | Read                                              |
| ----------------------------------------- | ------------------------------------------------- |
| Publish releases that cannot be changed   | [Production deployment](production-deployment.md) |
| Preview pull request                      | [Pull-request previews](pr-previews.md)           |
| Validate production behavior and recovery | [Production readiness](production-readiness.md)   |
| Diagnose mount, route, asset failure      | [Troubleshooting](troubleshooting.md)             |

> [!note]
> An App can appear in more than one Host. Each URL or page-area entry uses the
> unique Host ID from that Host's `atlas.config.ts`.

## Reference

- [App generator command](app/generate.md)
- [SDK reference](sdk.md)
- [Public TypeScript API](api.md)
- [Manifest reference](manifest.md)
