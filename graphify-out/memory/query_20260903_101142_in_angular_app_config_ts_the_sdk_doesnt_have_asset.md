---
type: "query"
date: "2026-09-03T10:11:42.501120+00:00"
question: "in angular app.config.ts the sdk doesnt have assetsUrl. why?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["angular-injection.ts", "app-assets.ts", "AtlasSdk"]
---

# Q: in angular app.config.ts the sdk doesnt have assetsUrl. why?

## Answer

Expanded graph vocabulary: angular asset assets config sdk url. Generated angularAppConfig imports AtlasSdk from @atlas/sdk and receives raw host SDK. Asset methods are assetUrl(path) and assetBaseUrl(), not assetsUrl. injectAtlasSdk in angular-injection.ts adds createAtlasAppAssetFacade using injected app context; app-assets.ts resolves asset base from context.manifest.remoteEntryUrl. Thus raw createAppConfig sdk lacks helpers at runtime as well as in its type. Use injected SDK in Angular provider factories or components; direct bootstrap config support needs an app-scoped facade before createAppConfig.

## Outcome

- Signal: useful

## Source Nodes

- angular-injection.ts
- app-assets.ts
- AtlasSdk