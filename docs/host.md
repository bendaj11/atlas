# Atlas Host

An Atlas Host is the main application page that users open. Build one when your
team owns page layout, browser navigation, shared services, and files that start
the page.
Atlas configuration chooses which App versions appear in each environment, so
Host source code does not hard-code App versions.

## Build a Host

1. [Generate a Host](host/generate.md).
2. Choose [Angular](angular/host-getting-started.md) or [React](react/host-getting-started.md).
3. Build the main page layout while keeping the required Atlas HTML attributes.
4. Run locally with [local development](local-development.md).

## Build The Host

| Need                                              | Read                                                                                          |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Generate Angular or React Host                    | [Generate a Host](host/generate.md)                                                           |
| Build page layout and places where Apps appear    | [Angular Host](angular/host-getting-started.md) / [React Host](react/host-getting-started.md) |
| Own top-level routes and navigation               | [Angular routing](angular/routing.md) / [React routing](react/routing.md)                     |
| Provide HTTP, events, host data, product services | [Angular SDK](angular/sdk.md) / [React SDK](react/sdk.md)                                     |
| Add assets and prevent style leaks                | [Angular assets](angular/assets-and-styles.md) / [React assets](react/assets-and-styles.md)   |
| Run Host or show local App                        | [Local development](local-development.md)                                                     |

## Ship The Host

| Need                                            | Read                                              |
| ----------------------------------------------- | ------------------------------------------------- |
| Generate files that start the Host in a browser | [Host bootstrap](bootstrap.md)                    |
| Publish Host and choose releases                | [Production deployment](production-deployment.md) |
| Verify deployed host and assets                 | [Production readiness](production-readiness.md)   |
| Diagnose startup, routing, loading failure      | [Troubleshooting](troubleshooting.md)             |

> [!warning]
> Do not remove an HTML attribute such as `data-atlas-route-outlet` while an App
> uses it. Without that element, Atlas has nowhere to show the App.

## Reference

- [Host generator command](host/generate.md)
- [SDK reference](sdk.md)
- [Public TypeScript API](api.md)
- [Manifest and runtime reference](manifest.md)
