# @atlas/bootstrap

Static browser bootstrap for Atlas Hosts: the `index.html`, `atlas.loader.js`, and `es-module-shims.js` files that start an Atlas Host in the browser. Most projects use it through the Atlas CLI and never import it directly.

## Install

```sh
npm install --save-dev --save-exact @atlas/cli
```

The `@atlas` packages are not on the public npm registry yet; [Get the packages](https://github.com/bendaj11/atlas/blob/main/docs/reference/compatibility.md#get-the-packages) explains how to install them.

`@atlas/cli` depends on `@atlas/bootstrap`. Install `@atlas/bootstrap` directly only if you generate bootstrap files from your own Node.js code.

## Usage

Generate the bootstrap for a Host project:

```sh
npx atlas bootstrap customer-host
```

The command writes the three files to the project's `dist/bootstrap` folder, for example `apps/customer-host/dist/bootstrap`. Your platform serves them together with a same-origin `atlas.runtime.json` that selects the Host, the environment, and the registries. The bootstrap itself contains no environment or registry URL, so you can serve the same files in every environment.

To generate the files from Node.js:

```ts
import { createAtlasBootstrapFiles } from '@atlas/bootstrap';

const files = createAtlasBootstrapFiles({ title: 'Customer portal' });

for (const file of files) console.log(file.path, file.contents.length);
```

A custom HTML template must keep an element with `id="atlas-host-root"` and a script element that loads `/atlas.loader.js`. The package root is Node.js only.

## Errors

When the loader cannot start a Host, it shows a startup error page with suggested actions and a button that clears overrides. Each failure has one of these codes: `DEPLOYMENT_INVALID`, `CATALOG_INVALID`, `HOST_MANIFEST_INVALID`, `ARTIFACT_URL_REJECTED`, `ARTIFACT_VERIFICATION_FAILED`, `OVERRIDE_INVALID`, `RESOURCE_UNAVAILABLE`, `HOST_REMOTE_INVALID`, `MODULE_LOADER_UNAVAILABLE`, `HOST_MOUNT_FAILED`, or `BOOTSTRAP_TEMPLATE_INVALID`. Unexpected errors without a code are reported as `ATLAS_BOOTSTRAP_FAILED`.

## Documentation

- [Host bootstrap](https://github.com/bendaj11/atlas/blob/main/docs/deploy/bootstrap.md): runtime config, loader flow, and the CSP, caching, and CORS contract.
- [Production deployment](https://github.com/bendaj11/atlas/blob/main/docs/deploy/production-deployment.md): publish and deploy Hosts and Apps.
- [Security](https://github.com/bendaj11/atlas/blob/main/docs/deploy/security.md): the Atlas trust model.
