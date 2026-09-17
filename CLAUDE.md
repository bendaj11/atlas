## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Tests

- While iterating, run a single spec: `node --experimental-vm-modules node_modules/jest/bin/jest.js --config <config> --testPathPattern=<path/to/file.specs.ts>`. Run the full suite only before committing.
- Jest is capped at `maxWorkers: 50%` with `workerIdleMemoryLimit: 512MB` in `jest.config.json`. Do not override with `--maxWorkers` locally; multiple Claude sessions run tests concurrently on the same machine.
