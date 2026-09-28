# @atlas/cli

The Atlas command-line interface. It generates hosts, apps, and exported widgets, runs them locally, publishes build output to a static registry, deploys releases to environments, creates the host bootstrap files, and verifies deployed hosts.

## Install

The `@atlas` packages are not on the public npm registry. Point the `@atlas` scope at your organization's registry in `.npmrc` first, then install the CLI as a development dependency:

```sh
npm install --save-dev --save-exact @atlas/cli
```

The CLI requires Node.js `^22.12.0` or `^24.0.0`.

## Example

```sh
npx atlas g host shop-host --framework react
npx atlas g app orders --framework react
npx atlas dev shop-host

npx atlas publish orders --version 1.4.0 --registry-url https://assets.example.com/atlas
npx atlas deploy orders --to production --version 1.4.0 --registry-url https://assets.example.com/atlas
npx atlas bootstrap shop-host
```

`publish` uses existing build output; it does not run your build. `deploy` selects a published release for one environment and never copies artifact files. To deploy from one registry to another, pass `--source-registry-url` and `--target-registry-url` together instead of `--registry-url`.

Run `npx atlas <command> --help` for the options of one command.

## Documentation

- [CLI reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/cli.md): every command, flag, and environment variable
- [Registry reference](https://github.com/bendaj11/atlas/blob/main/docs/reference/registry.md)
- [Production deployment](https://github.com/bendaj11/atlas/blob/main/docs/deploy/production-deployment.md)
- [Publish with Artifactory](https://github.com/bendaj11/atlas/blob/main/docs/deploy/artifactory.md)
- [Tutorial](https://github.com/bendaj11/atlas/blob/main/docs/get-started/tutorial.md)
