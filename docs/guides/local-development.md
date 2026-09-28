---
title: Local development
description: Run a Host and its Apps on your machine with `npx atlas dev`, configure preview URLs, and, when you need it, run local code inside a deployed page.
---

# Local development

`npx atlas dev` runs a Host or an App on your machine with live reload, inside a real Host page. This page covers the everyday workflow first: a local Host with local Apps. The [advanced section](#advanced-develop-against-deployed-pages) covers deployed pages, published versions, and API proxying.

## How `npx atlas dev` works

`npx atlas dev <project>` starts three things:

- **The framework development server** for the project, such as Vite or the Angular dev server. It serves the project's federation entry, `remoteEntry.json`.
- **The [development session](../introduction/glossary.md#development-session)** on port 4400. It records which local builds are running. Every `npx atlas dev` process on your machine shares this one development session, so a local Host and several local Apps work together.
- **A local Host page**, only when you run a Host and its preview is a `localhost` URL. It serves the same bootstrap page that production uses.

When the local Host page loads, the Atlas loader reads the development session and loads the local builds in place of deployed versions. No browser extension is involved. The Host and the Apps need no special development code.

## Before you begin

- Generate a Host and an App. See [Generate a Host](../get-started/generate-host.md) and [Generate an App](../get-started/generate-app.md).
- This page uses a Host in `apps/customer-host` and an App in `apps/orders`. The folder depends on your [workspace](../introduction/glossary.md#workspace) kind. `npx atlas dev` accepts the project name or its folder.
- Run all commands from your workspace root (the folder that contains your projects) or from the project folder.
- You do not need [Columbus](columbus.md) to run a local Host with local Apps. You need it only in the advanced case of running local code inside a deployed page.

## Configure previews

A _preview_ is the Host page where you want to see your code. You list previews in the project's `package.json` under `atlas.previews`:

```json
{
  "atlas": {
    "previews": [
      "http://localhost:4200/orders",
      "https://staging.example.com/orders"
    ]
  }
}
```

The rules are:

- Each entry must be an absolute `http` or `https` URL.
- An App must define at least one preview. Without one, `npx atlas dev` fails with `package.json atlas.previews is required for atlas dev apps.`
- A Host can omit `atlas.previews`. It then runs on `http://localhost:4200`, or on the port configured for the Host project.
- With one preview, `npx atlas dev` uses it. With several, `npx atlas dev` asks you to pick one. In a non-interactive terminal, several previews are an error.
- For an App, include the route in the URL. If you give only the Host origin and the App has one route for that Host, Atlas appends that route. If the App has several routes, Atlas asks which one to open.

`atlas.previews` lives in `package.json` because it is your team's development setting. It never enters `atlas.config.ts` or a published manifest, and it does not affect production.

## Run a Host locally

1. In a terminal, start the Host:

   ```sh
   npx atlas dev customer-host
   ```

   > **Expected result:** Atlas starts the framework server, waits until it is ready, and prints the preview URL, similar to this:
   >
   > ```text
   > Starting React dev server on port 4300
   > Dev server ready in 2.4s
   > App preview: http://localhost:4200
   > ```

2. Atlas opens the preview in your browser. To skip that, pass `--no-open`.

   > **Expected result:** The Host layout renders. Until you run an App, the route outlet is empty.

The browser-facing port is the Host's configured development port, 4200 by default. The Host's framework server runs on a separate internal port.

## Run an App inside the local Host

1. Add the local Host page to the App's `atlas.previews`, as shown in [Configure previews](#configure-previews):

   ```json
   {
     "atlas": {
       "previews": ["http://localhost:4200/orders"]
     }
   }
   ```

2. In a first terminal, start the Host:

   ```sh
   npx atlas dev customer-host
   ```

3. In a second terminal, start the App:

   ```sh
   npx atlas dev orders
   ```

   > **Expected result:** Atlas prints `App preview: http://localhost:4200/orders` and opens it. The App renders inside the Host, and saving an App file reloads it.

Atlas finds the host ID for the App in this order: the only Host the App declares routes or slots for, the Host that owns the route in the preview URL, or the `hostId` in the preview page's `/atlas.runtime.json`.

## Edit a local library

If the Host or the App imports a workspace library that points to compiled files, run that library's build watcher next to `npx atlas dev`. Keep the library's sharing settings. You do not need to add it to `skip`. See [Developing local packages](workspaces-and-ci.md#developing-local-packages).

## Command options

| Option                      | Applies to   | Effect                                                                                                                                                                                                                      |
| --------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--port <port>`             | Host and App | For a Host, the browser-facing port. For an App, its framework server port. Defaults to the port in the project config, then 4200 for Hosts and 4201 for Apps.                                                              |
| `--bootstrap-port <port>`   | Host         | The browser-facing port of the local Host page.                                                                                                                                                                             |
| `--host-client-port <port>` | Host         | The internal port of the Host's framework server. It must differ from the browser-facing port when the preview is local. For its default, see [Internal Host port default](../reference/cli.md#internal-host-port-default). |
| `--control-port <port>`     | Host and App | The port of the development session. Defaults to 4400.                                                                                                                                                                      |
| `--no-open`                 | Host and App | Does not open the browser.                                                                                                                                                                                                  |
| `--prepare-only`            | Host and App | Writes the local override document to `.atlas/local-overrides.json`, then exits without starting servers.                                                                                                                   |

`npx atlas dev` loads environment variables from `.env.local` and `.env` in the project folder, then in the workspace root. Variables that are already set in the process environment win.

## Advanced: develop against deployed pages

The sections below are for later, when the local workflow is not enough.

### Run inside a deployed page

You can run a local App or Host inside a deployed page, for example staging. This requires [Columbus](columbus.md), because the deployed loader only reads local builds through the extension.

1. Install [Columbus](columbus.md#install-columbus).
2. Add the deployed page to `atlas.previews`:

   ```json
   {
     "atlas": {
       "previews": ["https://staging.example.com/orders"]
     }
   }
   ```

3. Start the App or Host:

   ```sh
   npx atlas dev orders
   ```

   > **Expected result:** Atlas opens the deployed page, Columbus passes the local build to the loader, and the page renders your local code. The Columbus toolbar icon counts the active overrides.

For a Host, the deployed page must serve `/atlas.runtime.json` with the same host ID as your local Host. Atlas checks this before it starts. No local Host page is started in this case. The deployed page loads your local Host code instead.

On a deployed page, the loader does not contact `localhost` on its own. Only Columbus asks the development session for local builds, and local builds must use loopback URLs. See [How Columbus keeps the page safe](columbus.md#how-columbus-keeps-the-page-safe).

### Load published versions with a local Host

By default, a local Host page loads only local builds. To also load the Apps that an environment deploys, give `npx atlas dev` the public URL of your artifact registry:

```sh
ATLAS_REGISTRY_URL=https://registry.example.com/atlas npx atlas dev customer-host
```

You can pass `--registry-url https://registry.example.com/atlas` instead, or set `ATLAS_REGISTRY_URL` in `.env.local`. Atlas reads the Host's deployment from the `production` environment. Pass `--environment <name>` to use another one.

Atlas reads the host deployment manifest at `<registry>/environments/<environment>/hosts/<hostId>/manifest.json` and loads local builds on top of it. If that file cannot be loaded, Atlas prints a warning and serves only local builds. With a registry URL, Columbus can also offer PR previews and other releases from the registry's `registry.json`.

### Proxy API requests from an Angular Host

A local Angular Host page can forward API requests to a backend. Configure the proxy in `angular.json` on the Host's `serve-original` target, or on `serve`:

```json
"serve-original": {
  "options": {
    "proxyConfig": "config/local-api-proxy.json"
  }
}
```

```json
{
  "/get-data": {
    "target": "http://localhost:8080",
    "changeOrigin": true,
    "secure": false
  }
}
```

Atlas loads the file with Angular's own proxy loader. Requests to the local Host page that match a proxy context, such as `http://localhost:4200/get-data`, go to the Angular dev server, which applies the proxy. Any format and option that Angular supports works, including JavaScript proxy files and WebSocket proxying. Contexts follow Angular semantics: `/get-data` also matches paths below it.

This proxy exists only in local development and only for a local Host page. Configure production routing in your own infrastructure, such as an ingress, an API gateway, or a backend for frontend.

## Troubleshooting

For errors such as `atlas.previews is required`, a preview that does not expose runtime config, or a remote entry that does not load, see [Troubleshooting](../troubleshooting.md#local-development).

## Next steps

- [Columbus](columbus.md)
- [Testing Apps and Hosts](testing-apps-and-hosts.md)
- [Workspaces and CI](workspaces-and-ci.md)
