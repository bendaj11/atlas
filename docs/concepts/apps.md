# Atlas App

An Atlas App is a feature shown inside a Host, such as Orders or Billing. Build
one when your team owns that feature. An App declares where it appears, uses
services supplied by the Host through the SDK, and does not import Host code.

## Build an App

1. [Generate an App](../get-started/generate-app.md).
2. Choose [Angular](../guides/angular/app.md) or [React](../guides/react/app.md).
3. Declare the URL or page area where it appears in `atlas.config.ts`.
4. Declare development host pages in `package.json` `atlas.previews`, then run
   it inside a Host with [local development](../guides/local-development.md#configure-app-previews).

## Build The App

| Need                                          | Read                                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Generate Angular or React App                 | [Generate an App](../get-started/generate-app.md)                                                          |
| Build UI and choose where it appears          | [Angular App](../guides/angular/app.md) / [React App](../guides/react/app.md)   |
| Own inner routes and navigate to another app  | [Angular routing](../guides/angular/routing.md) / [React routing](../guides/react/routing.md)                   |
| Use HTTP, host data, events, product services | [Angular SDK](../guides/angular/sdk.md) / [React SDK](../guides/react/sdk.md)                                   |
| Add assets and keep styles isolated           | [Angular assets](../guides/angular/assets-and-styles.md) / [React assets](../guides/react/assets-and-styles.md) |
| Export reusable UI                            | [Exported widgets](../guides/exported-widgets.md)                                                     |
| Verify app-host contracts                     | [Consumer testing](../guides/testing-apps-and-hosts.md)                                                     |

## Ship The App

| Need                                      | Read                                              |
| ----------------------------------------- | ------------------------------------------------- |
| Publish releases that cannot be changed   | [Production deployment](../deploy/production-deployment.md) |
| Preview pull request                      | [Pull-request previews](../guides/pr-previews.md)           |
| Validate production behavior and recovery | [Production readiness](../deploy/production-readiness.md)   |
| Diagnose mount, route, asset failure      | [Troubleshooting](../troubleshooting.md)             |

> [!note]
> An App can appear in more than one Host. Each URL or page-area entry uses the
> unique Host ID from that Host's `atlas.config.ts`.

## Reference

- [App generator command](../get-started/generate-app.md)
- [SDK reference](../reference/sdk.md)
- [Public TypeScript API](../reference/api.md)
- [Manifest reference](../reference/manifests.md)
