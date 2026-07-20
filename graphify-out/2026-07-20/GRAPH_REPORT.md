# Graph Report - atlas  (2026-07-20)

## Corpus Check
- 411 files · ~149,776 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3916 nodes · 7045 edges · 260 communities (220 shown, 40 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `28999380`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- AtlasManifest
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Releasing Atlas packages
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- generate-nx.ts
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- angular-generator.ts
- Manifests
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 166
- Community 167
- Community 168
- Community 169
- Community 172
- Community 177
- SDK Reference
- graphify reference: extra exports and benchmark
- Host bootstrap
- Local development and Columbus
- Production Readiness
- @angular/animations
- Security
- native-federation.ts
- Angular Routing
- Angular SDK
- Exported Widgets
- React Routing
- React SDK
- Atlas Overview
- Documentation Guidelines
- Atlas Overview
- React Troubleshooting
- Atlas Documentation
- Atlas Columbus Extension
- graphify reference: query, path, explain
- arguments.ts
- Consumer Testing
- Build A React App
- scripts
- @atlas/cli
- Atlas
- EmptyHostDataState.tsx
- react-context.ts
- Changelog
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Project Instructions
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- extraction-spec.md
- README.md
- README.md
- README.md
- README.md
- publication-context.ts
- React Project Guide
- package.json
- react-router.ts
- @atlas/runtime
- @atlas/sdk
- es-module-shims
- zone.js
- README.md
- README.md
- README.md
- README.md
- README.md
- README.md
- bootstrap.ts
- publish-config.ts
- readAngularProjectPort
- ui.ts
- generate-dependencies.ts
- local-development.specs.ts
- generate-overlay.ts
- Workspace integration
- @angular/animations
- Static registry
- Atlas
- publishConfig
- Angular Assets And Styles
- AtlasFederationAdapter
- engines
- @angular/common

## God Nodes (most connected - your core abstractions)
1. `AtlasManifest` - 45 edges
2. `manifest()` - 36 edges
3. `addIssue()` - 33 edges
4. `CliArguments` - 26 edges
5. `runAtlasCli()` - 26 edges
6. `title()` - 24 edges
7. `AtlasExportedWidgetManifest` - 24 edges
8. `scripts` - 23 edges
9. `validateManifest()` - 23 edges
10. `detectWorkspace()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `build()` --indirect_call--> `manifest()`  [INFERRED]
  packages/cli/tests/publish.specs.ts → apps/columbus/tests/manifest-versions.specs.ts
- `getItem()` --indirect_call--> `manifest()`  [INFERRED]
  packages/runtime/tests/loader.specs.ts → apps/columbus/tests/manifest-versions.specs.ts
- `cleanupSupersededPublications()` --indirect_call--> `manifest()`  [INFERRED]
  packages/cli/src/publish.ts → apps/columbus/tests/manifest-versions.specs.ts
- `uniquePullRequests()` --indirect_call--> `manifest()`  [INFERRED]
  packages/cli/src/publish.ts → apps/columbus/tests/manifest-versions.specs.ts
- `prepareStaticPrCleanup()` --indirect_call--> `manifest()`  [INFERRED]
  packages/cli/src/static-registry.ts → apps/columbus/tests/manifest-versions.specs.ts

## Import Cycles
- 2-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 3-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 3-file cycle: `packages/cli/src/generate-nx.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts`
- 4-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/loader/native-federation.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 4-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/loader/runtime-discovery.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 4-file cycle: `packages/cli/src/generate-files.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts -> packages/cli/src/generate-files.ts`
- 4-file cycle: `packages/cli/src/generate-json.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts -> packages/cli/src/generate-json.ts`
- 5-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/loader/native-federation.ts -> packages/runtime/src/loader/runtime-discovery.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 5-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/stylesheets.ts -> packages/runtime/src/loader/runtime-discovery.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 5-file cycle: `packages/cli/src/generate-angular.ts -> packages/cli/src/generate-json.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts -> packages/cli/src/generate-angular.ts`

## Communities (260 total, 40 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (73): angularAppAppComponent(), angularAppDetailsComponent(), angularAppEntry(), angularAppHomeComponent(), angularAppRoutes(), angularSinglePageAppComponent(), angularSinglePageAppEntry(), appSourceReadme() (+65 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (24): SdkProviderInput, RoutePlacement, AtlasHostRuntimeOptions, AtlasLoaderOptions, AtlasWidgetLoaderOptions, RuntimeMount, RuntimePlacement, AtlasNativeFederationImporters (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (19): CONTENT_TYPES, publicationContentType(), assertLease(), DeploymentLease, encodeLease(), environmentBoolean(), errorName(), errorStatus() (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (65): asObject(), assertUsableAngularBuildPackage(), AtlasDevBuildService, AtlasDevService, BootstrapResponseOptions, browserOpenCommand(), closeServer(), configuredHostIds() (+57 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (46): ProcessCommand, runProcess(), spawnProcess(), asDependencyMap(), AtlasPackageManager, AtlasScaffoldOptions, AtlasTask, AtlasWorkspaceKind (+38 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (9): Build, CI reconciliation, Custom HTML, Docker and Nginx, Host bootstrap, Runtime configuration, Static platforms, Verify (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (29): createPopupElement(), renderError(), applyBounds(), createPopupBar(), enableDrag(), overlayStyle, popupBarStyle(), popupStyle (+21 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): dependencies, @angular/animations, @angular/platform-browser, @angular/router, @atlas/schema, rxjs, tslib, @angular/animations (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (6): AtlasFetchHttpClient, AtlasHttpClient, AtlasHttpClientInput, AtlasHttpRequestOptions, HttpClient, withBody()

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (46): build, esbuild, serve, serve-original, builder, configurations, options, development (+38 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (41): AtlasGenerateService, availableAppsMessage(), asStringRecord(), DEPENDENCY_FIELDS, dependencyDeclared(), DependencyField, dependencyManifestPath(), existingFrameworkVersionInfo() (+33 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (45): build, esbuild, serve, serve-original, builder, configurations, options, development (+37 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (45): build, esbuild, serve, serve-original, builder, configurations, options, development (+37 more)

### Community 13 - "Community 13"
Cohesion: 0.04
Nodes (44): dependencies, @angular/animations, @angular-architects/native-federation, @angular/common, @angular/compiler, @angular/core, @angular/platform-browser, @angular/router (+36 more)

### Community 14 - "Community 14"
Cohesion: 0.04
Nodes (44): dependencies, @angular/animations, @angular-architects/native-federation, @angular/common, @angular/compiler, @angular/core, @angular/platform-browser, @angular/router (+36 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (47): AtlasDevOverrideDocument, AtlasDevSessionDocument, AtlasRuntimeOverrideDocument, RegistrySnapshot, WidgetRegistryOptions, actionableMessage(), ensureActionableError(), suggestedActionFor() (+39 more)

### Community 16 - "Community 16"
Cohesion: 0.26
Nodes (8): AtlasBrowserNavigation, AtlasInnerLocation, AtlasLocation, AtlasNavigateOptions, AtlasNavigationListener, createTestHostSdk(), createMemoryNavigation(), splitPath()

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (38): AtlasValidationIssue, validateHostCatalog(), validateUniqueManifestIds(), FRAMEWORKS, normalizeRoutePath(), PlacementUniqueness, validateExportedWidget(), validateExportedWidgets() (+30 more)

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (3): Assets And Styles, Routing And Navigation, Troubleshooting

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (28): angularComponentCount(), appDocument(), assertSingleComponentDeclaration(), atlasPackageRange(), availablePort(), catalogManifestIds(), closeServer(), closingJoinedAppPreservesHost() (+20 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (60): Injectable, AtlasDefaultHostRouteComponent, AtlasNavigationItemsService, HostOptions, startHost(), syncAngularRouterWithBrowserUrl(), Component, emitHostError() (+52 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (25): absoluteHttpUrl(), asRecord(), AssetExpectation, AtlasVerificationReport, AtlasVerificationStatus, AtlasVerifyOptions, AtlasVerifyService, createReport() (+17 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (40): dependencies, @atlas/runtime, @atlas/schema, @atlas/sdk, es-module-shims, react, react-dom, react-router-dom (+32 more)

### Community 23 - "Community 23"
Cohesion: 0.17
Nodes (19): AtlasInterceptCatalog, AtlasInterceptDevSession, AtlasInterceptManifest, AtlasReleaseChannel, atlasWindow, catalogRequestHostId(), installAtlasCatalogInterceptor(), isDevSession() (+11 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (37): dependencies, @atlas/schema, @atlas/sdk, es-module-shims, react, react-dom, react-router-dom, devDependencies (+29 more)

### Community 25 - "Community 25"
Cohesion: 0.05
Nodes (37): dependencies, @atlas/schema, @atlas/sdk, es-module-shims, react, react-dom, react-router-dom, devDependencies (+29 more)

### Community 26 - "Community 26"
Cohesion: 0.06
Nodes (35): bugs, dependencies, @atlas/bootstrap, @atlas/schema, description, engines, node, exports (+27 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (35): bugs, dependencies, @atlas/schema, @atlas/sdk, description, engines, node, exports (+27 more)

### Community 28 - "Community 28"
Cohesion: 0.06
Nodes (34): bugs, dependencies, @atlas/schema, description, engines, node, exports, files (+26 more)

### Community 29 - "Community 29"
Cohesion: 0.05
Nodes (37): devDependencies, babel-plugin-react-compiler, @file-services/node, react, react-dom, react-router-dom, @stylable/core, @stylable/node (+29 more)

### Community 30 - "Community 30"
Cohesion: 0.08
Nodes (8): AtlasPublicationObjectMetadata, StoredPublicationObject, DirectoryPublicationStorage, FailingMutableStorage, isMissingFile(), publicationFixture(), build(), LeaseLossStorage

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (33): AssetResolver, AtlasAssetRewriteRelease, createRemoteAssetResolver(), ElementInsertionPatchState, isElement(), isExternalUrl(), isFragmentUrl(), isNode() (+25 more)

### Community 32 - "Community 32"
Cohesion: 0.06
Nodes (31): compilerOptions, baseUrl, composite, declaration, lib, module, moduleResolution, outDir (+23 more)

### Community 33 - "Community 33"
Cohesion: 0.08
Nodes (13): createTestContainer(), createTestElement(), createAssetElement(), createHostStatusContainer(), createStylesheetDocument(), getItem(), isTestAssetElement(), isTestStyleLink() (+5 more)

### Community 34 - "Community 34"
Cohesion: 0.06
Nodes (30): bugs, description, engines, node, exports, files, homepage, app (+22 more)

### Community 36 - "Community 36"
Cohesion: 0.19
Nodes (15): createDeferred(), createHostCatalog(), createRouteManifest(), createRoutePlacement(), createSlotManifest(), createTestDocument(), duplicateRegistryWidgetResult(), duplicateWidgetResult() (+7 more)

### Community 37 - "Community 37"
Cohesion: 0.07
Nodes (27): action, default_icon, default_popup, default_title, background, service_worker, type, content_scripts (+19 more)

### Community 38 - "Community 38"
Cohesion: 0.07
Nodes (27): compilerOptions, baseUrl, composite, declaration, declarationMap, exactOptionalPropertyTypes, experimentalDecorators, lib (+19 more)

### Community 39 - "Community 39"
Cohesion: 0.11
Nodes (20): ColumbusManifest, createStorage(), createStorageArea(), InterceptorScenario, isColumbusManifest(), isRecord(), jsonResponse(), readColumbusFile() (+12 more)

### Community 40 - "Community 40"
Cohesion: 0.42
Nodes (8): createPublicationStorage(), assertExpectedRegistryRevision(), AtlasPublishService, cleanupSupersededPublications(), publicationOrder(), publishFiles(), readRegistry(), withPublicationLease()

### Community 41 - "Community 41"
Cohesion: 0.08
Nodes (25): apps/**/*.driver.ts, apps/**/*.specs.ts, jest, node_modules, packages/**/*.driver.ts, packages/**/*.specs.ts, playwright.config.ts, scripts/**/*.driver.ts (+17 more)

### Community 42 - "Community 42"
Cohesion: 0.17
Nodes (29): affectedHostIds(), artifactKey(), assertArtifactManifest(), assertSafeRegistryId(), assertStaticRegistry(), AtlasRegistryResult, compareArtifactIdentity(), compareNewestFirst() (+21 more)

### Community 43 - "Community 43"
Cohesion: 0.10
Nodes (27): ATLAS_BROWSER_LOADER, AtlasBootstrapFile, AtlasBootstrapOptions, createAtlasBootstrapFiles(), createBootstrapHtml(), createNginxConfig(), escapeHtml(), normalizedOrigins() (+19 more)

### Community 44 - "Community 44"
Cohesion: 0.08
Nodes (23): compilerOptions, baseUrl, composite, declaration, declarationMap, lib, module, moduleResolution (+15 more)

### Community 45 - "Community 45"
Cohesion: 0.08
Nodes (23): compilerOptions, baseUrl, composite, declaration, declarationMap, exactOptionalPropertyTypes, lib, module (+15 more)

### Community 46 - "Community 46"
Cohesion: 0.08
Nodes (23): compilerOptions, baseUrl, composite, declaration, declarationMap, lib, module, moduleResolution (+15 more)

### Community 47 - "Community 47"
Cohesion: 0.09
Nodes (23): scripts, atlas, build, build:affected, build:examples, check:unused, ci:affected, ci:full (+15 more)

### Community 48 - "Community 48"
Cohesion: 0.21
Nodes (10): PopupHostProvider(), PopupNavigationContext, PopupNavigationContextValue, PopupNavigationProvider(), PopupOverridesProvider(), PopupSessionProvider(), usePopupSession(), artifactConfigurationPath() (+2 more)

### Community 49 - "Community 49"
Cohesion: 0.17
Nodes (21): usePopupNavigation(), channelRank(), supportsHost(), uniqueVersions(), versionKey(), ArtifactConfigurationPage(), VersionDropdown(), VersionDropdownProps (+13 more)

### Community 50 - "Community 50"
Cohesion: 0.09
Nodes (21): compilerOptions, composite, declaration, declarationMap, exactOptionalPropertyTypes, lib, module, moduleResolution (+13 more)

### Community 51 - "Community 51"
Cohesion: 0.25
Nodes (8): Columbus, Common errors, Consume a widget, Create a widget, Exported Widgets, External-registry widgets, Performance and caching, Same-registry widgets

### Community 52 - "Community 52"
Cohesion: 0.07
Nodes (30): Bootstrap changed but platform did not roll out, Bootstrap deployment, Catalog missing an app, Choose a versioning policy, CORS, Credentials, Custom publication behavior, Deployment model (+22 more)

### Community 53 - "Community 53"
Cohesion: 0.13
Nodes (17): artifacts, atlasPackages, buildProject(), dependencyOverrides(), execute, installDependencies(), packageManager, packageManagerSpecification() (+9 more)

### Community 54 - "Community 54"
Cohesion: 0.28
Nodes (11): App(), usePopupHost(), usePopupOverrides(), root, AppRoutes(), ArtifactsListPage(), filterArtifacts(), OverrideTable() (+3 more)

### Community 55 - "Community 55"
Cohesion: 0.19
Nodes (20): createOverrideDocument(), disabledOverridesKey(), findAtlasHostTab(), hasTabId(), InspectableTab, inspectTab(), isLoopbackPage(), isStoredManifest() (+12 more)

### Community 56 - "Community 56"
Cohesion: 0.10
Nodes (20): compilerOptions, composite, declaration, exactOptionalPropertyTypes, jsx, lib, module, moduleResolution (+12 more)

### Community 57 - "Community 57"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+12 more)

### Community 58 - "Community 58"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+12 more)

### Community 59 - "Community 59"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, skipLibCheck (+12 more)

### Community 61 - "Community 61"
Cohesion: 0.08
Nodes (34): AtlasBuildResult, AtlasPublicationLease, AtlasPublicationStorage, artifactIndexPath(), artifactPrefix(), assertPublicationMetadata(), AtlasProjectBuilder, AtlasPrPruneResult (+26 more)

### Community 62 - "Community 62"
Cohesion: 0.17
Nodes (12): 1. Create and push a branch, 2. Open the pull request, 3. Push more commits, 4. Merge or close the PR, 5. Reconcile nightly, Cache and deletion behavior, Freshness check, Lifecycle at a glance (+4 more)

### Community 63 - "Community 63"
Cohesion: 0.16
Nodes (15): BrowserStorage, isRecord(), readOverride(), restrictExtensionHosts(), StoredOverrideDocument, builtExtensionPath, createTestExtension(), ExtensionSession (+7 more)

### Community 65 - "Community 65"
Cohesion: 0.19
Nodes (16): appendEntries(), COMMAND_ALIASES, COMMAND_HELP, CommandHelp, HelpEntry, ROOT_COMMANDS, ROOT_EXAMPLES, formatCommandHelp() (+8 more)

### Community 66 - "Community 66"
Cohesion: 0.11
Nodes (18): compilerOptions, composite, declaration, declarationMap, exactOptionalPropertyTypes, lib, module, moduleResolution (+10 more)

### Community 67 - "Community 67"
Cohesion: 0.20
Nodes (17): PopupOverridesContext, PopupOverridesContextValue, PopupSessionContext, PopupSessionContextValue, AtlasExtensionManifest, ScopePicker(), ScopePickerProps, clearAllOverridesInSession() (+9 more)

### Community 68 - "Community 68"
Cohesion: 0.06
Nodes (50): AtlasHostUi, AtlasHostUiOptions, AtlasHostMountState, AtlasWidgetErrorRenderContext, AtlasWidgetRenderContext, createMountBoundary(), createRoutePlacementPlan(), createRouteTitleController() (+42 more)

### Community 69 - "Community 69"
Cohesion: 0.23
Nodes (11): tick(), createManualModalRef(), createTestElement(), createTestWidget(), hasModalClose(), ManualModalRef, modalCloseFrom(), mount() (+3 more)

### Community 70 - "Community 70"
Cohesion: 0.12
Nodes (17): @atlas/generators, @aws-sdk/client-s3, @aws-sdk/credential-provider-node, @inquirer/select, dependencies, @atlas/bootstrap, @atlas/generators, @atlas/runtime (+9 more)

### Community 71 - "Community 71"
Cohesion: 0.21
Nodes (6): createDevSessionStore(), DevSessionStore, readJsonRequest(), startOwnedControlServer(), writeError(), writeJson()

### Community 72 - "Community 72"
Cohesion: 0.22
Nodes (7): AtlasArtifactOverride, AtlasHostData, AtlasOverrideDocument, AtlasReleaseChannel, ChromeMockOptions, hostData, MockTab

### Community 73 - "Community 73"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 74 - "AtlasManifest"
Cohesion: 0.23
Nodes (16): assertRegistry(), assertWidgetId(), compareNewestFirst(), createRegistryWidgetResolver(), fetchRegistry(), isRecord(), LazyRegistry, matchesSelection() (+8 more)

### Community 75 - "Community 75"
Cohesion: 0.24
Nodes (12): deploymentCatalog, isDeploymentCatalog(), isManifest(), isRecord(), runCli(), cdnRoot, expectCatalogVersion(), hostFallbackCases (+4 more)

### Community 76 - "Community 76"
Cohesion: 0.13
Nodes (14): angularCompilerOptions, strictInjectionParameters, strictTemplates, compilerOptions, experimentalDecorators, lib, module, moduleResolution (+6 more)

### Community 77 - "Community 77"
Cohesion: 0.13
Nodes (14): angularCompilerOptions, strictInjectionParameters, strictTemplates, compilerOptions, experimentalDecorators, lib, module, moduleResolution (+6 more)

### Community 78 - "Community 78"
Cohesion: 0.13
Nodes (14): angularCompilerOptions, strictInjectionParameters, strictTemplates, compilerOptions, experimentalDecorators, lib, module, moduleResolution (+6 more)

### Community 79 - "Community 79"
Cohesion: 0.12
Nodes (17): jest, devDependencies, jest, @playwright/test, prettier, ts-jest, turbo, @types/jest (+9 more)

### Community 80 - "Community 80"
Cohesion: 0.13
Nodes (14): bin, atlas, bugs, description, exports, homepage, license, main (+6 more)

### Community 81 - "Community 81"
Cohesion: 0.12
Nodes (16): default, types, exports, ./angular, ./federation, ./host, ./overlay, ./react (+8 more)

### Community 82 - "Community 82"
Cohesion: 0.18
Nodes (15): addBrokenRoute(), addSecondCatalogRelease(), addVersionFixtures(), artifacts, buildBootstrap(), cdn, createDistinctArtifact(), createExternalWidgetRegistry() (+7 more)

### Community 83 - "Community 83"
Cohesion: 0.38
Nodes (3): BrowserWindowLike, createBrowserNavigation(), createFakeWindow()

### Community 84 - "Community 84"
Cohesion: 0.14
Nodes (13): bugs, description, engines, node, homepage, license, main, name (+5 more)

### Community 85 - "Community 85"
Cohesion: 0.14
Nodes (13): bugs, description, engines, node, homepage, license, main, name (+5 more)

### Community 86 - "Community 86"
Cohesion: 0.15
Nodes (12): compilerOptions, outDir, extends, files, include, atlas.config.ts, ../../../packages/runtime/src/**/*.ts, ../../../packages/schema/src/**/*.ts (+4 more)

### Community 87 - "Community 87"
Cohesion: 0.15
Nodes (12): compilerOptions, outDir, extends, files, include, atlas.config.ts, ../../../packages/runtime/src/**/*.ts, ../../../packages/schema/src/**/*.ts (+4 more)

### Community 89 - "Community 89"
Cohesion: 0.40
Nodes (5): Angular Project Guide, App Files, Choose Your Role, Host Files, Task Guides

### Community 90 - "Community 90"
Cohesion: 0.14
Nodes (11): Angular Examples, App Domain, Cross-Framework Use, Host Domain, What To Copy, Examples, App Domain, Cross-Framework Use (+3 more)

### Community 91 - "Community 91"
Cohesion: 0.17
Nodes (12): 10. Release And Deploy, 1. Generate The Host, 2. Understand The Angular Bootstrap, 3. Build The Product Shell, 4. Provide Host Services Through The SDK, 5. Connect Authentication Deliberately, 6. Run The Host Locally, 7. Mount An App During Development (+4 more)

### Community 92 - "Community 92"
Cohesion: 0.24
Nodes (11): assertPacked(), canonicalLicense, execute, exportedTargets(), normalizeText(), outputDirectory, packageDirectories, readArchiveFile() (+3 more)

### Community 93 - "Community 93"
Cohesion: 0.17
Nodes (11): bugs, description, engines, node, homepage, license, name, packageManager (+3 more)

### Community 94 - "Community 94"
Cohesion: 0.18
Nodes (10): action, chrome, InjectionResult, runtime, runtime.onInstalled, runtime.onMessage, scripting, storage.local (+2 more)

### Community 95 - "Community 95"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, extends, files, include, atlas.config.ts, src/main.ts, src/**/*.ts (+1 more)

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (6): Atlas, Contributing, First Local System, How Atlas Fits Together, Packages, Start Here

### Community 97 - "Community 97"
Cohesion: 0.42
Nodes (8): isManifest(), isRecord(), isRegistry(), manifestFromUnknown(), readCatalog(), readJson(), readManifestIndex(), readRegistry()

### Community 98 - "Community 98"
Cohesion: 0.20
Nodes (19): HostLoadResult, loadPopupHost(), PopupHostContext, PopupHostContextValue, artifactKey(), errorMessage(), readDisabledOverrides(), readHostData() (+11 more)

### Community 99 - "Community 99"
Cohesion: 0.17
Nodes (12): Angular host bootstrap, Angular production deployment, Bootstrap loads but route is blank, Common Angular failures, CSS rejected, Generated build integration, Local production build, Native federation build recursion (+4 more)

### Community 100 - "Community 100"
Cohesion: 0.24
Nodes (3): createAppContext(), files(), splitUrl()

### Community 101 - "Community 101"
Cohesion: 0.18
Nodes (8): archives, artifacts, expectedArchives, packageDirectory, packageManifest, releaseDirectory, root, verifiedPackagesDirectory

### Community 102 - "Releasing Atlas packages"
Cohesion: 0.40
Nodes (5): App Files, Choose Your Role, Host Files, React Project Guide, Task Guides

### Community 103 - "Community 103"
Cohesion: 0.20
Nodes (9): compilerOptions, outDir, extends, files, include, atlas.config.ts, src/main.ts, src/**/*.ts (+1 more)

### Community 104 - "Community 104"
Cohesion: 0.18
Nodes (10): compilerOptions, outDir, extends, files, include, atlas.config.ts, .atlas/**/*.ts, src/main.ts (+2 more)

### Community 105 - "Community 105"
Cohesion: 0.18
Nodes (10): compilerOptions, outDir, extends, files, include, atlas.config.ts, .atlas/**/*.ts, src/main.ts (+2 more)

### Community 106 - "Community 106"
Cohesion: 0.22
Nodes (3): createHostSdk(), CommerceHostSdk, ProjectHostSdk

### Community 107 - "Community 107"
Cohesion: 0.21
Nodes (14): BadgeRefreshDependencies, countDevSessionOverrides(), createBadgeRefresher(), DevSessionBadgeState, isLoopbackBadgeHost(), isOverrideDocument(), overrideCount(), parseJson() (+6 more)

### Community 108 - "generate-nx.ts"
Cohesion: 0.33
Nodes (6): 1. Generate, 2. Declare Placement, 3. Build Feature UI, 4. Run Inside Host, 5. Test And Continue, Build An Angular App

### Community 109 - "Community 109"
Cohesion: 0.36
Nodes (4): createAppContext(), files(), splitUrl(), navigate()

### Community 111 - "Community 111"
Cohesion: 0.05
Nodes (42): atlas:config, AWS_*, BITBUCKET_*, ^build, CI_*, CODEX_SANDBOX_NETWORK_DISABLED, dist/bootstrap/**, GITHUB_* (+34 more)

### Community 112 - "Community 112"
Cohesion: 0.29
Nodes (3): directory, plainImporter(), stylablePath()

### Community 113 - "Community 113"
Cohesion: 0.17
Nodes (12): 10. Release And Deploy, 1. Generate The Host, 2. Understand The React Bootstrap, 3. Build The Product Shell, 4. Provide Host Services Through The SDK, 5. Connect Authentication Deliberately, 6. Run The Host Locally, 7. Mount An App During Development (+4 more)

### Community 114 - "Community 114"
Cohesion: 0.17
Nodes (12): Bootstrap loads but route is blank, Chunk URL points to local origin, Common React failures, CSS rejected, Generated build integration, Local production build, Publish, React host bootstrap (+4 more)

### Community 115 - "Community 115"
Cohesion: 0.38
Nodes (5): AtlasAppRootComponent, OrderDetailsComponent, OrdersHomeComponent, routes, Component

### Community 116 - "Community 116"
Cohesion: 0.43
Nodes (5): createDeploymentFetch(), deploymentHostManifest(), deploymentManifest(), hostRemoteBytes, remoteBytes

### Community 117 - "Community 117"
Cohesion: 0.29
Nodes (7): default, types, exports, ./angular, ./react, default, types

### Community 118 - "Community 118"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Remove host ID input from atlas dev app and derive target from launch URL., Source Nodes

### Community 119 - "Community 119"
Cohesion: 0.57
Nodes (5): createCatalog(), createHostManifest(), createManifest(), createManifestCandidate(), issueAt()

### Community 120 - "Community 120"
Cohesion: 0.18
Nodes (11): 10. Switch to routine CI, 1. Install Atlas, 2. Generate the projects, 3. Connect apps to the host, 4. Test locally, 5. Create S3-compatible storage, 6. Configure browser access, 7. Publish the first environment (+3 more)

### Community 122 - "angular-generator.ts"
Cohesion: 0.21
Nodes (10): renderLoading(), AtlasRuntimeContext, AtlasSdk, AtlasSdkContext, useAtlasSdk(), createReactAtlasSdk(), createWidgetComponent(), ReactAtlasSdk (+2 more)

### Community 123 - "Manifests"
Cohesion: 0.15
Nodes (11): AppReadiness, AtlasMountedApp, AtlasRuntimeController, createAppReadiness(), createLoadingEmitter(), createRuntimeMount(), hostPlacements(), placementKey() (+3 more)

### Community 124 - "Community 124"
Cohesion: 0.18
Nodes (7): AtlasVitePlugin, executeFile, factoryPath, federationConfig, federationExposes(), Middleware, workspaceRoot

### Community 125 - "Community 125"
Cohesion: 0.47
Nodes (3): frameworkApis, readSdkPackage(), CustomerHostSdk

### Community 126 - "Community 126"
Cohesion: 0.18
Nodes (11): devDependencies, @angular/cli, @angular/compiler-cli, @angular-devkit/build-angular, @types/node, typescript, @angular/cli, @angular/compiler-cli (+3 more)

### Community 127 - "Community 127"
Cohesion: 0.47
Nodes (5): docker(), execute, requireOk(), root, waitForHealth()

### Community 128 - "Community 128"
Cohesion: 0.40
Nodes (5): App Domain, Deployment Domain, Host Domain, Monorepos, React Assets And Styles

### Community 132 - "Community 132"
Cohesion: 0.40
Nodes (5): workspaces, apps/*, examples/apps/*, examples/hosts/*, packages/*

### Community 133 - "Community 133"
Cohesion: 0.40
Nodes (5): scripts, build, publish-lib, test, typecheck

### Community 134 - "Community 134"
Cohesion: 0.50
Nodes (3): cli, runCli(), packageJson

### Community 135 - "Community 135"
Cohesion: 0.40
Nodes (5): optional, peerDependenciesMeta, @angular/core, react, optional

### Community 136 - "Community 136"
Cohesion: 0.40
Nodes (5): dependencies, @atlas/schema, @atlas/sdk, @atlas/schema, @atlas/sdk

### Community 137 - "Community 137"
Cohesion: 0.40
Nodes (5): @angular/core, react, peerDependencies, @angular/core, react

### Community 138 - "Community 138"
Cohesion: 0.40
Nodes (5): scripts, build, publish-lib, test, typecheck

### Community 139 - "Community 139"
Cohesion: 0.22
Nodes (9): optional, optional, peerDependenciesMeta, @angular/core, @angular/platform-browser, react, vite, optional (+1 more)

### Community 140 - "Community 140"
Cohesion: 0.40
Nodes (5): dependencies, @atlas/schema, @softarc/native-federation-runtime, @atlas/schema, @softarc/native-federation-runtime

### Community 141 - "Community 141"
Cohesion: 0.22
Nodes (9): @angular/core, @angular/platform-browser, react, vite, peerDependencies, @angular/core, @angular/platform-browser, react (+1 more)

### Community 142 - "Community 142"
Cohesion: 0.40
Nodes (5): scripts, build, publish-lib, test, typecheck

### Community 145 - "Community 145"
Cohesion: 0.50
Nodes (4): app, native-federation, keywords, cli

### Community 146 - "Community 146"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 147 - "Community 147"
Cohesion: 0.50
Nodes (4): app, native-federation, keywords, runtime

### Community 148 - "Community 148"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 149 - "Community 149"
Cohesion: 0.40
Nodes (5): files, dist/**/*.d.ts, dist/**/*.js, federation-config.cjs, federation-config.d.cts

### Community 150 - "Community 150"
Cohesion: 0.50
Nodes (4): app, typescript, keywords, sdk

### Community 151 - "Community 151"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 152 - "Community 152"
Cohesion: 0.16
Nodes (14): createReleaseWorkspace(), packageDirectories, writeJson(), main(), nextVersion(), prepareRelease(), releaseTypes, root (+6 more)

### Community 156 - "Community 156"
Cohesion: 0.67
Nodes (3): files, dist/**/*.d.ts, dist/**/*.js

### Community 158 - "Community 158"
Cohesion: 0.67
Nodes (3): files, dist/**/*.d.ts, dist/**/*.js

### Community 160 - "Community 160"
Cohesion: 0.25
Nodes (8): Angular SDK, App Domain, Events, Host Domain, Host-Owned UI, Loading And Readiness, Navigation, Testing

### Community 161 - "Community 161"
Cohesion: 0.20
Nodes (10): Angular Adapter, Contracts, Framework API vocabulary, Lifecycle, Navigation, Public API, React Adapter, Runtime (+2 more)

### Community 163 - "Community 163"
Cohesion: 0.20
Nodes (10): Apps, Architecture, Browser loader, Deliberate limits, Host client, One selection model, Release data flow, Rollback boundaries (+2 more)

### Community 164 - "Community 164"
Cohesion: 0.20
Nodes (6): { createAngularFederationConfig }, { createAngularFederationConfig }, { createAngularFederationConfig }, ReactHostViteConfigOptions, ReactViteConfigOptions, ReactWidgetEntry

### Community 166 - "Community 166"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: when running apps locally why do I need to specify both host url and id? isn't url enough?, Source Nodes

### Community 167 - "Community 167"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Can Atlas infer host id from a configured host URL when an app declares multiple hosts?, Source Nodes

### Community 169 - "Community 169"
Cohesion: 0.09
Nodes (26): CliArguments, SupportedFramework, NxDevTargetOptions, WidgetAppSelection, formatHelp(), cliVersion(), configuredArtifactIds(), configuredRuntimeUrls() (+18 more)

### Community 172 - "Community 172"
Cohesion: 0.50
Nodes (4): Package checks, Prepare a release, Publishing policy, Releasing Atlas packages

### Community 177 - "Community 177"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 183 - "SDK Reference"
Cohesion: 0.20
Nodes (10): `@atlas/runtime`, `@atlas/schema`, `@atlas/sdk/host`, `@atlas/sdk/overlay`, Events between apps, Framework Adapters, Loading and failure UI, Runtime Observability (+2 more)

### Community 184 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 185 - "Host bootstrap"
Cohesion: 0.05
Nodes (21): ATLAS_APP_CONTEXT, ATLAS_SDK, AtlasSdk, injectAppLoaded(), injectAtlasAppContext(), injectAtlasSdk(), createLocationStrategy(), notifyPopState() (+13 more)

### Community 186 - "Local development and Columbus"
Cohesion: 0.22
Nodes (9): Columbus selection model, Local development and Columbus, Prepare without starting servers, Recovery from a broken host, Run a local app, Run a local host client, Safety checks, Troubleshooting (+1 more)

### Community 187 - "Production Readiness"
Cohesion: 0.22
Nodes (9): App Checklist, Assign Owners, Host Checklist, Production Readiness, Ready To Release, Registry And CDN Checklist, Release Verification, Rollback Rehearsal (+1 more)

### Community 188 - "@angular/animations"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Local app development should never require host id; user supplies only launch URL., Source Nodes

### Community 189 - "Security"
Cohesion: 0.22
Nodes (9): HTTP controls, Integrity and immutability, Loader validation, Override recovery, Publication controls, Runtime hardening, Runtime policy, Security (+1 more)

### Community 190 - "native-federation.ts"
Cohesion: 0.25
Nodes (8): Angular Compiler Rejects `emitDeclarationOnly`, Angular Remote Entry Does Not Load, Angular Troubleshooting, Host APIs Are Missing, Inner Routing Escapes The App, Install Fails With Peer Conflicts, Spinner Never Disappears, The App Does Not Load

### Community 191 - "Angular Routing"
Cohesion: 0.25
Nodes (8): Angular Routing, App Domain, Common Mistakes, Cross-App Navigation, Deployment Domain, Host Domain, How The Host Chooses An App, Inner Angular Routes

### Community 192 - "Angular SDK"
Cohesion: 0.67
Nodes (3): ./lifecycle, default, types

### Community 194 - "Exported Widgets"
Cohesion: 0.67
Nodes (3): App manifest, Host manifest, Manifests

### Community 195 - "React Routing"
Cohesion: 0.13
Nodes (14): 1. Generate, 2. Declare Placement, 3. Build Feature UI, 4. Run Inside Host, 5. Test And Continue, Build A React App, App Domain, Common Mistakes (+6 more)

### Community 196 - "React SDK"
Cohesion: 0.25
Nodes (8): App Domain, Events, Host Domain, Host-Owned UI, Loading And Readiness, Navigation, React SDK, Testing

### Community 197 - "Atlas Overview"
Cohesion: 0.67
Nodes (3): ./navigation, default, types

### Community 198 - "Documentation Guidelines"
Cohesion: 0.29
Nodes (7): Choose One Page Type, Do, Do Not, Documentation Guidelines, Keep One Source Of Truth, Review Checklist, Write For One Audience And Outcome

### Community 199 - "Atlas Overview"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: how can I serve columbus locally so I can develop without the need to rebuild and install every time, Source Nodes

### Community 200 - "React Troubleshooting"
Cohesion: 0.27
Nodes (4): EditorOption(), EditorOptionProps, EmptyFrame(), EmptyFrameProps

### Community 201 - "Atlas Documentation"
Cohesion: 0.29
Nodes (7): Atlas Documentation, Build Or Change Something, Learn Atlas In Order, Look Up Exact Contracts, Maintain Atlas Itself, Supported Scope, Understand Why Atlas Works This Way

### Community 203 - "Atlas Columbus Extension"
Cohesion: 0.33
Nodes (5): Atlas Columbus Extension, Build And Install, Troubleshooting, Use, Verification

### Community 204 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 206 - "Consumer Testing"
Cohesion: 0.33
Nodes (6): App Domain, Consumer Testing, Deployment Domain, Host Domain, Local Integration, What To Test

### Community 207 - "Build A React App"
Cohesion: 0.29
Nodes (7): AppRouterLike, connectRouter(), createRouterOptions(), readAtlasInnerUrl(), readRouterUrl(), RouterLike, syncAtlasFromRouter()

### Community 208 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, atlas:bootstrap, atlas:config, atlas:publish, build, dev

### Community 209 - "@atlas/cli"
Cohesion: 0.33
Nodes (5): @atlas/cli, Commands, Install, Storage, Workspace integration

### Community 210 - "Atlas"
Cohesion: 0.29
Nodes (7): App Domain, Atlas Overview, Deployment Domain, Host Domain, Learn Next, Mental Model, Vocabulary

### Community 215 - "react-context.ts"
Cohesion: 0.05
Nodes (43): createDomHostSdk(), createSdkProviders(), NON_SDK_OPTION_NAMES, readSdkProperties(), AtlasDeploymentCatalog, AppBootstrap, createExportedWidget(), defineExportedWidget() (+35 more)

### Community 216 - "Changelog"
Cohesion: 0.50
Nodes (3): Added, Changelog, [Unreleased]

### Community 217 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 218 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 219 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 232 - "publication-context.ts"
Cohesion: 0.12
Nodes (32): assertAppConfig(), AtlasArtifactManifest, AtlasBuildService, buildTimestamp(), discoverExportedWidgets(), discoverStylesheets(), findArtifactRoot(), findArtifactRootIfPresent() (+24 more)

### Community 233 - "React Project Guide"
Cohesion: 0.30
Nodes (11): appendQueryValue(), matchRoutePart(), matchRoutePattern(), normalizeBasePath(), parseQuery(), scopePath(), splitRoutePath(), toInnerPath() (+3 more)

### Community 234 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 235 - "react-router.ts"
Cohesion: 0.29
Nodes (7): Asset URLs Break In Production, Host APIs Are Missing, Inner Routing Escapes The App, Install Fails With Peer Conflicts, React Troubleshooting, Spinner Never Disappears, The App Does Not Load

### Community 246 - "bootstrap.ts"
Cohesion: 0.12
Nodes (13): AppComponent, Component, bootstrap(), DemoRouteAnchorComponent, HostMountRequest, Component, mount(), mount() (+5 more)

### Community 248 - "publish-config.ts"
Cohesion: 0.18
Nodes (19): AtlasPublicationStorageSource, isPublicationStorage(), AtlasPublishOptions, closedPullRequests(), AtlasPublishConfig, AtlasPullRequestLookup, AtlasPullRequestResolver, AtlasPullRequestStatus (+11 more)

### Community 249 - "readAngularProjectPort"
Cohesion: 0.33
Nodes (6): ATLAS_HOST_FILES, ATLAS_INTEGRATION_FILES, DELEGATED_APP_FILES, DELEGATED_HOST_FILES, generatedOverlay(), isReactHostProvider()

### Community 250 - "ui.ts"
Cohesion: 0.67
Nodes (3): ./federation-config, require, types

### Community 252 - "generate-dependencies.ts"
Cohesion: 0.11
Nodes (36): addUniquePolyfill(), asObject(), ensureAngularFederationPolyfills(), ensureAngularNativeFederationTargets(), ensureAngularWorkspaceFederationConfig(), isNativeFederationTarget(), ProjectType, retargetAngularBuildReference() (+28 more)

### Community 254 - "local-development.specs.ts"
Cohesion: 0.13
Nodes (9): contentType(), DirectoryPublicationStorage, isMutable(), metadata(), delay(), cases, LocalDevelopmentCase, stopAtlasDev() (+1 more)

### Community 256 - "Workspace integration"
Cohesion: 0.08
Nodes (22): Angular Generators, App Domain, Framework Versions, Host Domain, Widgets, Workspaces, Generators, App Domain (+14 more)

### Community 259 - "Static registry"
Cohesion: 0.22
Nodes (9): Custom adapters, Lease safety, Mutable and immutable objects, Publication transaction, Registry selection, Rollback, Static registry, Storage configuration (+1 more)

### Community 260 - "Atlas"
Cohesion: 0.50
Nodes (4): CI, Deployment E2E, Faster Browser Iteration, Testing The Atlas Repository

### Community 262 - "publishConfig"
Cohesion: 0.29
Nodes (7): Before a Pull Request, Contributing to Atlas, Documentation, File Extensions, Releases, Repository Layout, Setup

### Community 263 - "Angular Assets And Styles"
Cohesion: 0.40
Nodes (5): Angular Assets And Styles, App Domain, Deployment Domain, Host Domain, Monorepos

### Community 265 - "AtlasFederationAdapter"
Cohesion: 0.09
Nodes (38): mapWithConcurrency(), loadAndMountHostCatalog(), artifactDirectoryUrl(), createNativeFederationImporters(), federationRemoteName(), hasMountFunction(), importNativeFederationRemote(), normalizeAppEntry() (+30 more)

## Knowledge Gaps
- **1397 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+1392 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `manifest()` connect `Community 98` to `Community 33`, `Community 68`, `Community 36`, `Community 39`, `Community 40`, `AtlasFederationAdapter`, `Community 42`, `AtlasManifest`, `Community 49`, `Community 17`, `Community 19`, `Community 20`, `Community 21`, `Community 55`, `Manifests`, `Community 61`, `Community 30`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `cleanupSupersededPublications()` connect `Community 40` to `publication-context.ts`, `Community 98`, `Community 61`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `run()` connect `Community 82` to `publication-context.ts`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 35 inferred relationships involving `manifest()` (e.g. with `createOverrideDocument()` and `readDisabledOverrides()`) actually correct?**
  _`manifest()` has 35 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1397 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07238413760152891 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0957983193277311 - nodes in this community are weakly interconnected._