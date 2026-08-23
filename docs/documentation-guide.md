# Documentation Guidelines

Use this page when adding or changing Atlas documentation. User-facing behavior
must remain discoverable from [the documentation map](README.md).

## Choose One Page Type

Each page should primarily serve one user need:

| Type         | User need                           | Atlas example                             |
| ------------ | ----------------------------------- | ----------------------------------------- |
| Tutorial     | Learn by completing a safe sequence | [Get Started](getting-started.md)         |
| How-to guide | Complete a known goal               | [Local development](local-development.md) |
| Explanation  | Understand concepts and tradeoffs   | [Architecture](architecture.md)           |
| Reference    | Look up exact facts and contracts   | [SDK reference](sdk.md)                   |

Do not mix a full tutorial, design essay, and exhaustive option list on one page.
Link to the relevant explanation or reference when detail would interrupt the
reader's task.

## Write For One Audience And Outcome

Start each guide with its audience, prerequisites, and finished state. Use the
terms from [Overview](overview.md). Prefer a complete working example over
several disconnected snippets.

For procedural guides:

1. Put steps in execution order.
2. State where each command runs.
3. Show required input before the command that consumes it.
4. Add a checkpoint with observable success after risky or multi-system steps.
5. Explain rollback beside activation, not in an unrelated page.

## Page Shape

Keep entry airy. Feature guides normally use this order:

1. One-sentence purpose and reader outcome.
2. Prerequisites only when they block progress.
3. Common scenarios, simplest and most frequent first.
4. Copy-complete examples with observable expected result.
5. Concise API table for APIs introduced on page.
6. Related guides and exhaustive reference.

Do not force API table onto conceptual page. When feature guide teaches
`navigateTo()`, document parameters, types, return value, errors, constraints
on that page. Shared SDK reference remains full catalog.

## Notes, Tips, And Warnings

Use callouts beside decision or action they affect:

- **Tip:** preferred shortcut or better default.
- **Note:** useful context reader can safely skip.
- **Warning:** data loss, security, deployment, or compatibility risk.
- **Expected result:** observable checkpoint after command or integration.

Do not use callouts as decoration or repeat surrounding paragraph. Put warning
before risky command; put checkpoint immediately after its step.

## Keep One Source Of Truth

- `getting-started.md` owns installation and first project generation.
- `host.md` and `app.md` own role-specific journey navigation.
- Framework guides own framework-specific generated files and code patterns.
- `atlas <command> --help` owns the current CLI option list.
- TypeScript declarations own exact public types.
- `registry.md` and `manifest.md` own generated storage and JSON contracts.

Other pages should link to these sources instead of copying them. Small command
examples are useful; copied option catalogs and repeated deployment tutorials
are not.

## Do

- Lead with what the reader will accomplish.
- Use direct language and consistent Atlas vocabulary.
- Distinguish local project names from stable UUID artifact IDs.
- Label placeholders and environment-specific values.
- Keep secrets out of browser-visible configuration and examples.
- Test commands or verify them against source and CLI help.
- Update docs in the same change as behavior.
- Remove obsolete pages and links when replacing a workflow.

## Do Not

- Start new users in API or package reference.
- Require readers to follow links to discover the next required step.
- Present several valid paths before teaching one working path.
- Duplicate role-specific journeys in framework pages.
- Document generated files as hand-edited configuration.
- Promise behavior not covered by code or tests.
- Use “simple,” “easy,” or “obvious” for work that can fail.
- Keep historical instructions in active guides; use Git history and changelog.

## Review Checklist

- [ ] Page has one primary type, audience, and outcome.
- [ ] Required steps appear in chronological order.
- [ ] Commands identify working directory and use current flags.
- [ ] Every relative Markdown link resolves.
- [ ] Examples use stable terminology and safe placeholders.
- [ ] Facts match implementation, tests, and generated output.
- [ ] New concepts appear in Overview or Architecture before reference use.
- [ ] Documentation map links the new or renamed page.
- [ ] Feature APIs have local table and link to canonical reference.
- [ ] Warnings, notes, and tips appear only where they change reader action.
- [ ] Duplicate or stale instructions were removed.
