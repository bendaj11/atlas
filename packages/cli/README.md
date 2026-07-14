# @atlas/cli

Package-manager-neutral tooling for generating, developing, building,
publishing, releasing, rolling back, and verifying Atlas hosts/apps.

```sh
# Choose one:
npm install --global @atlas/cli
pnpm add --global @atlas/cli
yarn global add @atlas/cli

atlas --help
```

For CI, prefer exact project dependency plus committed lockfile:

```sh
npm install --save-dev --save-exact @atlas/cli
npx atlas --help
```

Main workflow:

```sh
atlas g host customer-host --framework=react
atlas g app orders --framework=react --host=customer-host
atlas dev customer-host
atlas build orders --registry-base-url=https://cdn.example.com/atlas
atlas publish --plan=orders/dist/atlas-publication.json --dry-run
atlas release orders
atlas verify --runtime-url=https://customer.example/atlas.runtime.json
```

`dev`, `build`, and `release` accept local project names or paths. `rollback`
accepts stable host/app artifact UUID from `atlas.config.ts`.
Non-dry-run `publish`, `release`, and `rollback` require committed
`atlas.publish.ts` with explicit storage adapter.

Generation prompts use arrow-key selections and automatically run the detected
Yarn, pnpm, or npm install command. Use `--skip-install` only when another tool
owns dependency installation.

In Nx workspaces, Atlas delegates project scaffolding to the installed Nx
framework generator, then adds Atlas dependencies to the package manifest that
owns the project: project-level `package.json` when present, otherwise the
workspace root.

If that manifest already declares `@angular/core` or `react`, Atlas keeps the
existing framework version and aligns companion dependencies to it. A conflicting
`--framework-version` is reported and ignored for delegated Nx projects so Atlas
does not upgrade or downgrade the monorepo accidentally.

See [documentation map](https://github.com/bendaj11/atlas/blob/main/docs/README.md),
[getting started](https://github.com/bendaj11/atlas/blob/main/docs/getting-started.md),
and [production deployment](https://github.com/bendaj11/atlas/blob/main/docs/production-deployment.md).
