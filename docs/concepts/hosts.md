# Atlas Host

An Atlas Host is the main application page that users open. Build one when your
team owns page layout, browser navigation, shared services, and files that start
the page.
Atlas configuration chooses which App versions appear in each environment, so
Host source code does not hard-code App versions.

## Build a Host

1. [Generate a Host](../get-started/generate-host.md).
2. Choose [Angular](../guides/angular/host.md) or [React](../guides/react/host.md).
3. Build the main page layout while keeping the required Atlas HTML attributes.
4. Run locally with [local development](../guides/local-development.md).

## Build The Host

| Need                                              | Read                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Generate Angular or React Host                    | [Generate a Host](../get-started/generate-host.md)                                                           |
| Build page layout and places where Apps appear    | [Angular Host](../guides/angular/host.md) / [React Host](../guides/react/host.md) |
| Own top-level routes and navigation               | [Angular routing](../guides/angular/routing.md) / [React routing](../guides/react/routing.md)                     |
| Provide HTTP, events, host data, product services | [Angular SDK](../guides/angular/sdk.md) / [React SDK](../guides/react/sdk.md)                                     |
| Add assets and prevent style leaks                | [Angular assets](../guides/angular/assets-and-styles.md) / [React assets](../guides/react/assets-and-styles.md)   |
| Run Host or show local App                        | [Local development](../guides/local-development.md)                                                     |

## Ship The Host

| Need                                            | Read                                              |
| ----------------------------------------------- | ------------------------------------------------- |
| Generate files that start the Host in a browser | [Host bootstrap](../deploy/bootstrap.md)                    |
| Publish Host and choose releases                | [Production deployment](../deploy/production-deployment.md) |
| Verify deployed host and assets                 | [Production readiness](../deploy/production-readiness.md)   |
| Diagnose startup, routing, loading failure      | [Troubleshooting](../troubleshooting.md)             |

> [!warning]
> Do not remove an HTML attribute such as `data-atlas-route-outlet` while an App
> uses it. Without that element, Atlas has nowhere to show the App.

## Reference

- [Host generator command](../get-started/generate-host.md)
- [SDK reference](../reference/sdk.md)
- [Public TypeScript API](../reference/api.md)
- [Manifest and runtime reference](../reference/manifests.md)
