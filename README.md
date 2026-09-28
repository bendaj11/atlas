# Atlas

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Atlas is a micro-frontend platform for Angular and React. It lets several
teams build parts of one web product as separate projects, release each part on
its own schedule, and combine them into one page in the browser.

A **Host** is the page your users open: the layout, the navigation, and shared
services such as sign-in. An **App** is a feature, such as Orders or Billing,
that appears inside a Host. Each App is published as an immutable version, and
a deployment chooses which versions each environment shows. Rolling back an App
means deploying its previous version; nothing is rebuilt.

Atlas supports client-side rendering with Angular and React. An Angular Host
can show React Apps and a React Host can show Angular Apps.

Read [Why Atlas](docs/introduction/why-atlas.md) to see how Atlas compares with
Native Federation, single-spa, iframes, and build-time composition, and when it
is not the right fit.

## Quickstart

You need Node.js `^22.12.0 || ^24.0.0` and access to the npm registry that
hosts the `@atlas` packages. The packages are not on the public npm registry;
see the [Tutorial](docs/get-started/tutorial.md#before-you-start).

1. Create a project and install the CLI:

   ```sh
   mkdir atlas-tutorial && cd atlas-tutorial
   npm init -y
   npm install --save-dev --save-exact @atlas/cli
   ```

2. Generate a Host, then copy the `id` UUID from
   `apps/customer-host/atlas.config.ts`:

   ```sh
   npx atlas g host customer-host --framework=react
   ```

3. Generate an App for that Host. Replace the UUID with your host ID:

   ```sh
   npx atlas g app orders --framework=react --host-id=0a17281f-287b-4d89-a8ca-0ab0e577c506 --routing
   ```

4. Tell the App which Host page to open during development. In
   `apps/orders/package.json`, set:

   ```json
   {
     "atlas": {
       "previews": ["http://localhost:4200"]
     }
   }
   ```

5. Start the Host and the App in two terminals:

   ```sh
   # Terminal 1
   npx atlas dev customer-host
   ```

   ```sh
   # Terminal 2
   npx atlas dev orders
   ```

Your browser opens `http://localhost:4200/orders` and shows the Orders App
inside the Host. The [Tutorial](docs/get-started/tutorial.md) explains each
step and shows the expected output.

## Documentation

- [Documentation home](docs/README.md): the learning path and full index.
- [Overview](docs/introduction/overview.md): the parts of Atlas and who owns
  them.
- [Architecture](docs/introduction/architecture.md): how pages load and how
  releases work.
- [Production deployment](docs/deploy/production-deployment.md): publish and
  deploy to real environments.
- [CLI reference](docs/reference/cli.md) and
  [FAQ](docs/faq.md).

## Packages

| Package             | Purpose                                                                       |
| ------------------- | ----------------------------------------------------------------------------- |
| `@atlas/cli`        | Generate projects, run local development, build, publish, deploy, and verify. |
| `@atlas/runtime`    | Run inside a Host: load, verify, and mount Apps into routes and slots.        |
| `@atlas/sdk`        | Give Apps typed access to Host services, with Angular and React adapters.     |
| `@atlas/bootstrap`  | Generate the static bootstrap page and the browser loader that starts a Host. |
| `@atlas/schema`     | Types and validation for configuration, manifests, and the registry.          |
| `@atlas/generators` | Project templates used by the CLI.                                            |
| `@atlas/testkit`    | Test helpers and fixtures for App and Host tests.                             |

See [Packages](docs/reference/packages.md) for details on each package.

## Contributing

To build and test Atlas itself, read [CONTRIBUTING.md](CONTRIBUTING.md).

Atlas is available under the [MIT License](LICENSE).
