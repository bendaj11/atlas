---
title: Documentation guide
description: Learn how to structure, write, and verify Atlas documentation so every page reads and behaves the same way.
---

# Documentation guide

This guide explains how to add or change Atlas documentation. It is for anyone who edits files under `docs/`, `contributing/`, or a package README, and it sets the rules that reviewers check before a documentation change merges.

## Where documentation lives

Atlas keeps two kinds of documentation in separate places:

- **User documentation** lives in `docs/`. It is written for teams who build Hosts and Apps with Atlas. The entry point is [the documentation home](../docs/README.md), and every page under `docs/` must be linked from at least one other page.
- **Contributor documentation** lives in `contributing/`. It is written for people who change the Atlas repository itself, for example this guide, [testing](testing.md), and [releasing](releasing.md). Contributor pages never belong in `docs/`, and the documentation home links to them only from a small "Contributing" entry.

Package READMEs (`packages/*/README.md`) are short npm-facing pages. Each one says what the package does, shows how to install it, gives one example, and links to the full reference in `docs/`. Use absolute GitHub URLs in package READMEs, because npm does not resolve relative links.

## The documentation tree

User documentation follows this structure. Add a new page only when its content does not fit an existing page.

```text
docs/
  README.md          documentation home: one learning path and a section index
  introduction/      what Atlas is, why it exists, the architecture, and the glossary
  get-started/       the tutorial and the first-project generation pages
  concepts/          explanations that apply to every framework
  guides/
    react/           React-specific how-to guides
    angular/         Angular-specific how-to guides, with the same file names as react/
    *.md             framework-neutral how-to guides
  deploy/            production deployment, bootstrap, security, and operations
  reference/         exact CLI, SDK, API, configuration, manifest, and registry facts
  troubleshooting.md problems that affect every framework, with fixes
  faq.md             short answers to common questions
```

## Choose one page type

Atlas uses the four [Diátaxis](https://diataxis.fr/) page types. Each page serves exactly one of them, so a reader always knows what kind of help to expect.

| Type        | Reader need                                   | Atlas example                                            |
| ----------- | --------------------------------------------- | -------------------------------------------------------- |
| Tutorial    | Learn by completing one safe, guided sequence | [Tutorial](../docs/get-started/tutorial.md)              |
| How-to      | Reach a known goal in their own project       | [Local development](../docs/guides/local-development.md) |
| Explanation | Understand a concept and its tradeoffs        | [Architecture](../docs/introduction/architecture.md)     |
| Reference   | Look up an exact fact or contract             | [CLI reference](../docs/reference/cli.md)                |

Do not combine a tutorial, a design discussion, and an exhaustive option list on one page. When detail would interrupt the reader's task, link to the explanation or reference page that owns it.

## Keep one source of truth

Each fact has exactly one owning page. Other pages link to the owner instead of copying it, so a behavior change needs only one documentation edit. Short command examples are fine anywhere; copied option catalogs and repeated deployment walkthroughs are not.

| Topic                                                   | Owning page                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Installing Atlas and creating the first projects        | [`docs/get-started/tutorial.md`](../docs/get-started/tutorial.md)                                                                 |
| CLI commands, flags, and environment variables          | [`docs/reference/cli.md`](../docs/reference/cli.md)                                                                               |
| `atlas.config.ts` and runtime configuration fields      | [`docs/reference/configuration.md`](../docs/reference/configuration.md)                                                           |
| Manifest and registry storage layout and JSON contracts | [`docs/reference/manifests.md`](../docs/reference/manifests.md) and [`docs/reference/registry.md`](../docs/reference/registry.md) |
| Generated files and framework code patterns             | The framework guides in `docs/guides/react/` and `docs/guides/angular/`                                                           |
| Term definitions                                        | [`docs/introduction/glossary.md`](../docs/introduction/glossary.md)                                                               |

The React and Angular guide folders must contain the same file names. When you add `docs/guides/react/<page>.md`, add `docs/guides/angular/<page>.md` in the same change, and keep matching H2 headings wherever the content applies to both frameworks. Put problems that affect both frameworks in `docs/troubleshooting.md`, and keep only framework-specific problems in the framework troubleshooting pages.

## Start every page the same way

Every page under `docs/` starts with YAML frontmatter that contains a `title` and a `description`. The documentation check described in [Verify your change](#verify-your-change) fails when either field is missing. Contributor pages follow the same convention.

```md
---
title: Preview an app locally
description: Learn how to run an app against a deployed host on your machine.
---

# Preview an app locally

This guide shows you how to run an app on your machine inside a deployed host. It is for app teams who already generated an app with the CLI.
```

The `# Title` heading repeats the frontmatter title exactly. The paragraph that follows states the purpose of the page in one or two sentences: what the reader will learn or do, and who the page is for.

## Follow the page template

Tutorials and how-to guides use this order:

1. **Purpose.** One or two sentences that describe the outcome.
2. **Audience and prerequisites.** List only what blocks progress, such as a Node.js version or an existing host.
3. **Steps.** Number the steps in execution order. Say where each command runs, show any required input before the command that consumes it, and add an expected-result checkpoint after each step that produces something observable.
4. **Next steps.** End with a short "Next steps" or "Related" section that links to the logical follow-up pages.

A step with a checkpoint looks like this:

````md
1. In the workspace root, start the app:

   ```sh
   npx atlas dev orders
   ```

   > **Expected result:** The terminal prints an `App preview` link, and your browser opens it.
````

Show sample terminal output when it helps the reader confirm success. Explain how to roll back next to the step that activates a change, not on a separate page.

Explanation pages do not need numbered steps, but they still start with frontmatter and a purpose paragraph, and they still end with related links. Reference pages present facts in tables or definition lists and avoid narrative instructions.

## Write in a consistent voice

Write full English sentences in the second person ("you"), in the present tense, and in the active voice. Keep the articles: write "Install Atlas in the workspace that contains the host", not "Install Atlas in workspace containing host". Short sentences are welcome; clipped sentences are not.

Use sentence case for every heading ("Build the host", not "Build The Host"). Do not describe work as "simple", "easy", "just", or "obvious", because the reader may be the person for whom it is not.

Use callouts only when they change what the reader does, and place them next to the decision or action they affect:

- `> **Note:**` adds context that the reader can safely skip.
- `> **Tip:**` offers a better default or a shortcut.
- `> **Warning:**` flags a risk of data loss, a security issue, or a broken deployment. Put it before the risky command.
- `> **Expected result:**` describes the observable checkpoint directly after a step.

## Write commands and code samples

Follow these rules in every command and sample:

- Run the CLI as `npx atlas <command>`. Never write a bare `atlas` command or `pnpm exec atlas`, because readers may use npm, pnpm, or Yarn.
- Install the CLI with `npm install --save-dev --save-exact @atlas/cli`.
- Use `sh` for shell code fences, and use `ts`, `tsx`, `html`, or `json` for source files.
- Name the SDK instance `sdk` in every code sample.
- Use UUIDs for host and app IDs, and label them as placeholders, for example `3f6c1a52-8d2e-4b7a-9c1e-2a5f0d8b7e41` (replace with your host ID). Do not use readable IDs such as `customer-host`, because Atlas artifact IDs are UUIDs.
- Distinguish local project names, such as `orders`, from stable artifact IDs.
- Keep secrets out of browser-visible configuration and examples.
- Make sure every sample compiles against the current package exports and has no unused imports.

## Use canonical terminology

Use the terms defined in the [glossary](../docs/introduction/glossary.md) exactly, and do not introduce synonyms. For example, write "Host", not "host shell" or "main application page", and write "host anchors" for `AtlasRouteOutlet`, `AtlasSlot`, `AtlasHostLayout`, `AtlasHostStatus`, and their `<atlas-*>` element equivalents. Define a term, or link to the glossary, the first time a page uses it. Link the first mention of Columbus on each page to [the Columbus guide](../docs/guides/columbus.md).

## Verify facts against the code

Documentation describes what the code does today. Before you document a behavior, confirm it in the source under `packages/` or `apps/columbus/`, in the tests, or in the generated output. Check CLI flags with `npx atlas <command> --help` or in `packages/cli/src/help/content/`. When the code is ambiguous, leave the detail out instead of guessing, and never document a planned feature as if it already exists.

Update documentation in the same pull request as the behavior change. When you replace a workflow, remove the obsolete page and every link to it; Git history and the changelog keep the old instructions.

## Verify your change

Run the documentation check from the repository root:

```sh
pnpm verify:docs
```

The check reads every Markdown file that Git tracks or would track, except `CHANGELOG.md`, `graphify-out/`, `node_modules/`, and the agent tooling folders `.claude/` and `.codex/`. It fails when any of the following is true:

- A relative link points to a file that does not exist.
- A `#anchor` does not match a heading in the target file. The check uses GitHub heading slug rules and ignores headings inside code fences.
- A page under `docs/` is not linked from any other Markdown file.
- `docs/guides/react/` and `docs/guides/angular/` contain different file names.
- A page under `docs/` lacks frontmatter with a `title` and a `description`.
- A page under `docs/` or the root `README.md` has a frontmatter `title` that differs from its first `# ` heading.
- Prose in a page under `docs/` or the root `README.md` uses a banned term: "active host manifest", "host client", "host shell", "main application page", "the shell", or "app shell". The match ignores case. "shell" on its own stays allowed for command-line shells.
- Inline code in a page under `docs/` or the root `README.md` runs a CLI command without `npx`, such as `` `atlas dev` `` instead of `` `npx atlas dev` ``.
- A code sample under `docs/guides/angular/` assigns `injectAtlasSdk()` to a name other than `sdk`.

The style checks report each problem as `file:line`. Except for the Angular sample check, they ignore fenced code blocks.

CI runs the same check in the `docs` job of the Verify workflow. The implementation lives in `scripts/verify-docs.ts`.

## Review checklist

Before you request review, confirm the following:

- [ ] The page has one type, one audience, and one outcome.
- [ ] The page starts with frontmatter, a matching `# Title`, and a purpose paragraph.
- [ ] Headings use sentence case.
- [ ] Steps are in execution order, name the directory where each command runs, and include expected-result checkpoints.
- [ ] Commands use `npx atlas` and `sh` code fences.
- [ ] Samples use `sdk`, UUID placeholders, and current exports.
- [ ] Terms match the glossary, and Columbus links to its guide on first mention.
- [ ] Facts match the implementation, the tests, and the generated output.
- [ ] The documentation home or a parent page links to every new or renamed page.
- [ ] Duplicated or stale instructions were replaced with links to the owning page.
- [ ] `pnpm verify:docs` passes.

## Related

- [Documentation coverage](documentation-coverage.md) lists which page documents each product surface.
- [CLI output](cli-output.md) and [error handling](error-handling.md) define the wording rules for messages that documentation often quotes.
