# Workspace integration

Atlas integrates through native project targets or package scripts. Workspace tool remains source of truth for project discovery, affected selection, dependencies, caching, and execution order.

Workspace execution and release versioning are separate concerns. Nx Release,
Yarn's version workflow, Changesets, semantic-release, package versions, and
fully automated production tags can all establish a version before Atlas
publishes. Turbo does not calculate a release version, and `atlas:publish`
never increments one. See
[Version and build identity](production-deployment.md#version-and-build-identity)
for requirements, advantages, costs, and the recommended zero-manual-input tag
workflow.

## Mixed repositories

Atlas repositories may also contain API servers, workers, libraries, mobile apps, and ordinary frontends. Atlas adds targets only to generated Atlas hosts and apps.

Use native target discovery when auditing a workspace:

```bash
npx nx show projects --projects 'tag:atlas'
npx nx show projects --with-target atlas:publish
```

The tag identifies Atlas-generated projects in the Nx graph. Target discovery
answers the narrower deployment question: which projects can publish. Do not
maintain a separate CI list of Atlas projects.

## Nx

When `atlas g host` or `atlas g app` creates a project in an Nx workspace,
Atlas preserves the framework generator's project metadata and native `build`
target, adds the `atlas` project tag without removing existing tags, then writes
the required Atlas targets to that project's `project.json`. No manual target
or tag setup is required. This automatic update belongs to the Atlas generator;
projects created directly with `nx generate` are not converted into Atlas
projects.

Generated project metadata includes:

```json
{
  "tags": ["atlas"]
}
```

Generated app targets:

```json
{
  "atlas:config": {
    "executor": "nx:run-commands",
    "outputs": ["{projectRoot}/.atlas"],
    "options": {
      "command": "atlas compile-config orders"
    }
  },
  "atlas:publish": {
    "cache": false,
    "dependsOn": ["build"],
    "executor": "nx:run-commands",
    "options": {
      "command": "atlas publish orders --from-build-output",
      "forwardAllArgs": true
    }
  }
}
```

Hosts also receive:

```json
{
  "atlas:bootstrap": {
    "dependsOn": ["atlas:config"],
    "outputs": ["{projectRoot}/dist/bootstrap"],
    "executor": "nx:run-commands",
    "options": {
      "command": "atlas build-bootstrap customer-host --skip-compile",
      "forwardAllArgs": true
    }
  }
}
```

Native framework `build` remains intact. `atlas:publish` is non-cacheable because it mutates storage; its build dependencies remain cacheable.

First deployment:

```bash
npx nx run-many -t atlas:publish deploy
npx atlas verify
```

Routine deployment:

```bash
npx nx affected -t atlas:publish deploy
npx atlas verify
```

Nx skips projects lacking requested targets. No Atlas-specific graph or affected command exists.

## Turborepo

Generated package scripts:

```json
{
  "scripts": {
    "atlas:config": "atlas compile-config orders",
    "build": "vite build",
    "atlas:publish": "atlas publish orders --from-build-output"
  }
}
```

Hosts also expose `atlas:bootstrap`. Atlas merges missing task definitions into root `turbo.json` without replacing existing tasks.

Turborepo has no project-tag metadata or tag filter equivalent. Atlas therefore
does not add a synthetic Turbo tag. Use normal Turbo package-name or directory
filters for selection, and use the generated `atlas:publish` package script when
auditing which packages are Atlas projects capable of publication.

First deployment:

```bash
npx turbo run atlas:publish deploy
npx atlas verify
```

Routine deployment:

```bash
npx turbo run atlas:publish deploy --affected
npx atlas verify
```

Turbo `dependsOn` ensures framework build output exists before publication.
`atlas:publish` compiles and validates Atlas config itself.

## Yarn workspaces

Generated package scripts are workspace-native. Yarn 2+ with the workspace-tools plugin can select changed workspaces without listing packages:

```bash
yarn workspaces foreach --since --topological-dev run build
yarn workspaces foreach --since --topological-dev run atlas:publish
yarn workspaces foreach --since --topological-dev run deploy
npx atlas verify
```

Unlike Nx and Turbo, this Yarn command sequence does not infer the
`atlas:publish` task dependency, so it runs the framework `build` explicitly.
Do not run `atlas:config` separately; publish owns config compilation.

For first environment, omit `--since`.

Yarn Classic does not provide `workspaces foreach`, changed-workspace selection, or `--if-present`. Atlas still supports its workspace scripts, but routine mixed-repository CI should delegate selection to the repository's existing Nx, Turbo, or CI change-selection tool. Do not add a second Atlas graph to compensate for Yarn Classic's missing orchestration.

## pnpm workspaces

Use pnpm filtering and `--if-present` in mixed repositories:

```bash
pnpm --filter "...[origin/main]" -r --if-present run build
pnpm --filter "...[origin/main]" -r --if-present run atlas:publish
pnpm --filter "...[origin/main]" -r --if-present run deploy
pnpm exec atlas verify
```

These pnpm commands run the framework build explicitly because pnpm filtering
selects package scripts but does not apply the Nx or Turbo task graph. Publish
compiles Atlas config itself.

For first environment:

```bash
pnpm -r --if-present run build
pnpm -r --if-present run atlas:publish
pnpm -r --if-present run deploy
pnpm exec atlas verify
```

## Standalone projects

```bash
npm run build
npm run atlas:publish
npm run atlas:bootstrap  # host only
npx atlas verify
```

## Bootstrap and platform deployment

Atlas generates bootstrap bytes but does not invent Docker, Kubernetes, Vercel, CDN, or internal platform commands. Define organization-owned `deploy` script/target that consumes `dist/bootstrap` and its `atlas.bootstrap.json` digest.

CI always invokes normal workspace deployment target. Native affected selection and digest reconciliation decide whether rollout is needed.

## Why `--from-build-output` exists

Direct manual command is self-contained:

```bash
npx atlas publish orders
```

It runs native build before publishing.

Workspace targets already depend on native build, so generated scripts pass `--from-build-output`. This prevents nested Nx/Turbo execution and preserves workspace cache decisions.
