---
type: "query"
date: "2026-09-03T10:15:04.926233+00:00"
question: "Angular app imports local UI package index.less in angular.json but CSS variables and component styles are unavailable: Atlas or Turborepo?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["mountApp()", "stylesheets.ts", "document-styles.ts"]
---

# Q: Angular app imports local UI package index.less in angular.json but CSS variables and component styles are unavailable: Atlas or Turborepo?

## Answer

Expanded vocabulary: angular styles stylesheet scope css remote assets root. Graph located stylesheets.ts, document-styles.ts and mountApp. Source inspection: packages/runtime/src/index.ts mountApp defaults manifest.isolation to shadow-dom and passes boundary.styleTarget to loadManifestStyles. packages/runtime/src/stylesheets.ts links stylesheet unchanged into target. docs/angular/assets-and-styles.md L70 documents this behavior. Conditional diagnosis: CSS custom properties declared under :root in a stylesheet installed inside shadow root do not apply; use a :host declaration for shadow context, preserving :root for standalone use. Actual external app not inspected; confirm compiled CSS includes declarations and manifest stylesheet loads. Turborepo cache/build dependency configuration is alternative if CSS output is missing or stale.

## Outcome

- Signal: useful

## Source Nodes

- mountApp()
- stylesheets.ts
- document-styles.ts