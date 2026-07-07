# @atlas/cli

Package-manager-neutral command-line tooling for generating, developing,
building, rolling back, and verifying Atlas microfrontends.

```sh
# Choose one:
npm install --global @atlas/cli
pnpm add --global @atlas/cli
yarn global add @atlas/cli

atlas --help
```

Generation prompts use arrow-key selections and automatically run the detected
Yarn, pnpm, or npm install command. Use `--skip-install` only when another tool
owns dependency installation.

In Nx workspaces, Atlas delegates project scaffolding to the installed Nx
framework generator, then adds Atlas dependencies to the package manifest that
owns the project: project-level `package.json` when present, otherwise the
workspace root.

See the [Atlas getting-started guide](https://github.com/bendaj11/atlas/blob/main/docs/getting-started.md) for workspace and deployment workflows.
