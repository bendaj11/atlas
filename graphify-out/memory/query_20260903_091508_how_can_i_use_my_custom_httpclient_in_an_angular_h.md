---
type: "query"
date: "2026-09-03T09:15:08.124244+00:00"
question: "How can I use my custom httpClient in an Angular host to update signals and pass them into host data?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["AngularHostDataInput", "host-data.ts", "angular.ts"]
---

# Q: How can I use my custom httpClient in an Angular host to update signals and pass them into host data?

## Answer

Expanded graph vocabulary: angular host data signal http client. Verified packages/runtime/src/angular.ts and docs/angular/sdk.md: createCustomHostSdkOptions receives Injector; obtain the host-owned custom client with injector.get, use its HTTP results to update a service signal or create toSignal with explicit injector and handled Observable errors, and pass the signal reference as a top-level hostData field. bootstrapAngularHost supplies hostDataInjector automatically; manual startHost requires it for live updates. Consumers read injectAtlasSdk<CustomerHostSdk>().hostData(). Avoid injecting Atlas SDK during initial Angular bootstrap because runtime SDK reference is not set yet. Client service and request method are product-owned placeholders.

## Outcome

- Signal: useful

## Source Nodes

- AngularHostDataInput
- host-data.ts
- angular.ts