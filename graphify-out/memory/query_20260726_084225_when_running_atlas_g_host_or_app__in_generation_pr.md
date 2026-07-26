---
type: "query"
date: "2026-07-26T08:42:25.107357+00:00"
question: "when running atlas g host or app, in generation process im getting error atlas.config.ts: SyntaxError ; expected"
contributor: "graphify"
outcome: "useful"
source_nodes: ["config-compiler.ts", "AtlasGenerateService"]
---

# Q: when running atlas g host or app, in generation process im getting error atlas.config.ts: SyntaxError ; expected

## Answer

Expanded from graph vocabulary: atlas, config, template, import, resolution, schema, typescript, compiler, parse, host, app. AtlasGenerateService formats generated files using workspace tooling. Generator emitted modern import attributes with resolution-mode, which older formatter parsers reject. Changed generated host, app, and widget configs to parser-compatible import assertions while preserving TypeScript resolution-mode behavior; aligned examples and docs; added regression coverage.

## Outcome

- Signal: useful

## Source Nodes

- config-compiler.ts
- AtlasGenerateService