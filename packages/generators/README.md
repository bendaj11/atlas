# @atlas/generators

Project templates used by `@atlas/cli` to generate React and Angular Atlas hosts and apps.

Most applications should install `@atlas/cli` rather than invoke this package directly.

Audience: Atlas maintainers extending scaffolds. Generated project users should
run `atlas g host`, `atlas g app`, or `atlas g widget` through CLI. Generator
owns lifecycle/federation wiring; product teams own components, routes, styles,
tests, and `atlas.config.ts`. See [Generators](https://github.com/bendaj11/atlas/blob/main/docs/generators.md).

Host generation returns separate client and server file sets through
`generateHostProjects`; CLI writes them as sibling projects.
