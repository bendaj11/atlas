# Project Instructions

- Always use the `caveman` skill when replying in this project. Keep technical accuracy; use normal clarity for irreversible warnings or ambiguity, then resume caveman style.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## TypeScript tests

- Treat these rules as hard completion gates for every TypeScript unit or E2E test change.
- Colocate non-index source, spec, and local driver in one responsibility directory. Name specs `*.specs.ts` (or `*.specs.tsx` for React); keep E2E specs only in `e2e/`. Never add or retain unit specs in central `tests/` directories without an explicit documented exception.
- Use Jest. Use React Testing Library or Angular Testing Library for client tests. Query user-visible, accessible UI by role and name first; use `userEvent` for interactions. Do not assert CSS classes, DOM structure, component instances, private state, or private methods.
- Each `it` proves one behavior, contains exactly one `expect`, and is named `should <result> when <condition>`. Give every test fresh state; do not depend on test order.
- Test behavior owned by one source file. Mock non-trivial imports and external boundaries, including network, storage, time, randomness, routing, analytics, and third-party services. Do not make real HTTP calls from unit tests.
- Create a colocated driver for every test unless it is a genuinely simple pure or I/O function with no mocks, meaningful setup, teardown, or multiple behavior cases. Keep specs declarative: fixtures, mock setup, rendering, interaction, and semantic queries belong in the driver under `given`, `when`, and `get`.
- Use `@faker-js/faker` for generated mock fields. Create `*.testkit.ts` only after two or more colocated specs/drivers already reuse non-trivial doubles; never for one spec.
- Cover primary important success and failure/error branches, including async rejection when relevant. Do not over-test incidental details such as printed logs, unless producing logs is behavior owned by the unit. Test missing/empty input, permissions, and boundaries only when they affect primary logic. Await observable async outcomes with Testing Library queries or `waitFor`; never use arbitrary sleeps.
- E2E tests cover crucial workflows only, use stable user-visible locators and deterministic readiness checks, and isolate/clean up test data.
- After broad test migrations, run a package-wide structural audit. Passing Jest alone does not override these rules.
