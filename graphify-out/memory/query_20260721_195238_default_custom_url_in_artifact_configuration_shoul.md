---
type: "query"
date: "2026-07-21T19:52:38.942245+00:00"
question: "default custom url in artifact configuration should not have predefined value but a http://localhost:4200 place holder"
contributor: "graphify"
outcome: "useful"
source_nodes: ["createEditorDraft", "EditorDraft", "OverridesSelectionForm"]
---

# Q: default custom url in artifact configuration should not have predefined value but a http://localhost:4200 place holder

## Answer

Expanded via graph vocab: [artifact, configuration, custom, url, placeholder, draft, editor, override, input, localhost, manifest]. Changed createEditorDraft so a new/non-custom selection initializes customUrl to empty string. Existing local custom selection still restores its configured base URL. OverridesSelectionForm already uses placeholder http://localhost:4200; added regression assertions for empty default, restored custom URL, and placeholder.

## Outcome

- Signal: useful

## Source Nodes

- createEditorDraft
- EditorDraft
- OverridesSelectionForm