# Graph Report - atlas  (2026-07-21)

## Corpus Check
- 423 files · ~153,693 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3969 nodes · 7128 edges · 269 communities (233 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 78 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22085ff4`
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
- generate.ts
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
- generate-files.ts
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
- generate-angular.ts
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- readAngularProjectPort
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
- Testing The Atlas Repository
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
- readAngularProjectPort
- Community 156
- Community 157
- Community 158
- env.ts
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 166
- Community 167
- Community 168
- Community 169
- Build A React App
- atlas-host.specs.ts
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
- @angular-architects/native-federation
- React Routing
- React SDK
- @angular/common
- Documentation Guidelines
- Atlas Overview
- publishConfig
- Atlas Documentation
- Atlas Columbus Extension
- graphify reference: query, path, explain
- .run
- Consumer Testing
- widget-registry.ts
- scripts
- @atlas/cli
- Atlas
- EmptyHostDataState.tsx
- generate-overlay.ts
- react-context.ts
- Changelog
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- Project Instructions
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- Angular Assets And Styles
- extraction-spec.md
- README.md
- README.md
- README.md
- README.md
- publication-context.ts
- types.ts
- host-ui.ts
- Angular Troubleshooting
- @atlas/runtime
- @atlas/sdk
- es-module-shims
- .writeNxProject
- README.md
- README.md
- README.md
- README.md
- README.md
- README.md
- bootstrap.ts
- interaction.ts
- ./federation
- React Troubleshooting
- ui.ts
- readAngularProjectPort
- NetworkLimiter
- @angular/compiler
- local-development.specs.ts
- .resolveHostId
- Workspace integration
- atlas-host.specs.ts
- Atlas Overview
- Q: why am I seeing this error in columbus: Could not apply override; Custom URL must use localhost, 127.0.0.1, or [::1].
- Exported Widgets
- createTestElement
- Q: default custom url in artifact configuration should not have predefined value but a http://localhost:4200 place holder
- @angular/core
- AtlasFederationAdapter
- Releasing Atlas packages
- @atlas/runtime
- Manifests
- {
  createAngularFederationConfig,
  createReactAppViteConfig,
  createReactHostViteConfig,
  createReactWidgetEntries,
}

## God Nodes (most connected - your core abstractions)
1. `AtlasManifest` - 45 edges
2. `addIssue()` - 33 edges
3. `CliArguments` - 26 edges
4. `runAtlasCli()` - 26 edges
5. `title()` - 24 edges
6. `AtlasExportedWidgetManifest` - 24 edges
7. `scripts` - 23 edges
8. `validateManifest()` - 23 edges
9. `detectWorkspace()` - 22 edges
10. `AtlasHostManifest` - 22 edges

## Surprising Connections (you probably didn't know these)
- `mount()` --indirect_call--> `AtlasDefaultHostLayout()`  [INFERRED]
  examples/hosts/demo-react-host/src/host.tsx → packages/runtime/src/react.ts
- `VersionDropdownProps` --references--> `AtlasExtensionManifest`  [EXTRACTED]
  apps/columbus/src/ArtifactConfigurationPage/OverridesForm/OverrideVersionDropdown/OverrideVersionDropdown.tsx → apps/columbus/src/contracts.ts
- `ResolveSelectedManifestOptions` --references--> `EditorDraft`  [EXTRACTED]
  apps/columbus/src/popup/manifest-utils.ts → apps/columbus/src/popup/types.ts
- `AtlasInvocation` --references--> `SupportedFramework`  [EXTRACTED]
  packages/cli/src/interaction.ts → packages/cli/src/arguments.ts
- `HostDevSession` --references--> `AtlasHostManifest`  [EXTRACTED]
  packages/cli/src/dev.ts → packages/schema/src/atlas-host-manifest.ts

## Import Cycles
- 2-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 3-file cycle: `packages/cli/src/generate-nx.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts`
- 3-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 4-file cycle: `packages/cli/src/generate-json.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts -> packages/cli/src/generate-json.ts`
- 4-file cycle: `packages/cli/src/generate-files.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts -> packages/cli/src/generate-files.ts`
- 4-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/loader/native-federation.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 4-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/loader/runtime-discovery.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 5-file cycle: `packages/cli/src/generate-angular.ts -> packages/cli/src/generate-json.ts -> packages/cli/src/generate-paths.ts -> packages/cli/src/workspace.ts -> packages/cli/src/generate-nx.ts -> packages/cli/src/generate-angular.ts`
- 5-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/loader/native-federation.ts -> packages/runtime/src/loader/runtime-discovery.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`
- 5-file cycle: `packages/runtime/src/index.ts -> packages/runtime/src/stylesheets.ts -> packages/runtime/src/loader/runtime-discovery.ts -> packages/runtime/src/resilience.ts -> packages/runtime/src/observability.ts -> packages/runtime/src/index.ts`

## Communities (269 total, 36 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (73): angularAppAppComponent(), angularAppDetailsComponent(), angularAppEntry(), angularAppHomeComponent(), angularAppRoutes(), angularSinglePageAppComponent(), angularSinglePageAppEntry(), appSourceReadme() (+65 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (17): CONTENT_TYPES, publicationContentType(), assertLease(), DeploymentLease, encodeLease(), errorName(), errorStatus(), isMissingObject() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (30): isFileNotFoundError(), loadBootstrapTemplate(), assertUsableAngularBuildPackage(), AtlasDevOverrideDocument, BootstrapResponseOptions, CorruptAngularBuildPackage, createLocalDevCatalog(), deleteJson() (+22 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (46): ProcessCommand, runProcess(), spawnProcess(), asDependencyMap(), AtlasPackageManager, AtlasScaffoldOptions, AtlasTask, AtlasWorkspaceKind (+38 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (9): Build, CI reconciliation, Custom HTML, Docker and Nginx, Host bootstrap, Runtime configuration, Static platforms, Verify (+1 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (28): createPopupElement(), applyBounds(), createPopupBar(), enableDrag(), overlayStyle, popupBarStyle(), popupStyle, styleOverlay() (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (13): dependencies, @angular/compiler, @angular/platform-browser, @angular/router, @atlas/schema, rxjs, tslib, @angular/compiler (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.19
Nodes (15): createDeferred(), createHostCatalog(), createRouteManifest(), createRoutePlacement(), createSlotManifest(), createTestDocument(), duplicateRegistryWidgetResult(), duplicateWidgetResult() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (46): build, esbuild, serve, serve-original, builder, configurations, options, development (+38 more)

### Community 10 - "generate.ts"
Cohesion: 0.19
Nodes (16): ensureAtlasGeneratedFilesIgnored(), EQUIVALENT_ATLAS_IGNORE_PATTERNS, existingPackageName(), hasAtlasIgnorePattern(), isContainedBy(), isMissingFileError(), readFileIfPresent(), removeDelegatedReactViteConfigs() (+8 more)

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
Cohesion: 0.15
Nodes (17): SupportedFramework, FrameworkVersionInfo, frameworkLabel(), literalConfigValue(), atlasConfigNxTarget(), NxDevTargetOptions, nxTarget(), ATLAS_HOST_FILES (+9 more)

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (4): hostData, reactRoot, root, router

### Community 17 - "Community 17"
Cohesion: 0.21
Nodes (37): validateHostCatalog(), validateUniqueManifestIds(), FRAMEWORKS, normalizeRoutePath(), PlacementUniqueness, validateExportedWidget(), validateExportedWidgets(), validateExposes() (+29 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (28): angularComponentCount(), appDocument(), assertSingleComponentDeclaration(), atlasPackageRange(), availablePort(), catalogManifestIds(), closeServer(), closingJoinedAppPreservesHost() (+20 more)

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (3): AtlasHttpClient, HttpClient, withBody()

### Community 21 - "Community 21"
Cohesion: 0.11
Nodes (29): LocalBootstrapServerOptions, absoluteHttpUrl(), asRecord(), AssetExpectation, AtlasVerificationCheck, AtlasVerificationReport, AtlasVerificationStatus, AtlasVerifyOptions (+21 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (38): dependencies, @atlas/runtime, @atlas/schema, @atlas/sdk, es-module-shims, react, react-dom, react-router-dom (+30 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (23): AtlasInterceptCatalog, AtlasInterceptDevSession, AtlasInterceptManifest, AtlasInterceptOverrideDocument, AtlasReleaseChannel, atlasWindow, catalogRequestHostId(), installAtlasCatalogInterceptor() (+15 more)

### Community 24 - "Community 24"
Cohesion: 0.06
Nodes (35): dependencies, @atlas/schema, @atlas/sdk, es-module-shims, react, react-dom, react-router-dom, devDependencies (+27 more)

### Community 25 - "Community 25"
Cohesion: 0.06
Nodes (35): dependencies, @atlas/schema, @atlas/sdk, es-module-shims, react, react-dom, react-router-dom, devDependencies (+27 more)

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
Cohesion: 0.17
Nodes (24): addUniqueString(), alignDelegatedAngularFederationConfig(), alignDelegatedTsconfig(), asObject(), collectNxPathValues(), commandValues(), declaresAtlasConfigOutput(), delegatesToDevTarget() (+16 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (33): AssetResolver, AtlasAssetRewriteRelease, createRemoteAssetResolver(), ElementInsertionPatchState, isElement(), isExternalUrl(), isFragmentUrl(), isNode() (+25 more)

### Community 32 - "Community 32"
Cohesion: 0.06
Nodes (31): compilerOptions, baseUrl, composite, declaration, lib, module, moduleResolution, outDir (+23 more)

### Community 33 - "Community 33"
Cohesion: 0.08
Nodes (6): createAssetElement(), isTestAssetElement(), renderLoading(), TestAssetElement, TestStyleLink, TestStylesheetDocument

### Community 34 - "Community 34"
Cohesion: 0.06
Nodes (30): bugs, description, engines, node, exports, files, homepage, app (+22 more)

### Community 35 - "Community 35"
Cohesion: 0.08
Nodes (7): AtlasPublicationObjectMetadata, StoredPublicationObject, DirectoryPublicationStorage, FailingMutableStorage, isMissingFile(), publicationFixture(), LeaseLossStorage

### Community 36 - "Community 36"
Cohesion: 0.10
Nodes (25): createDomHostSdk(), createSdkProviders(), NON_SDK_OPTION_NAMES, readSdkProperties(), SdkProviderInput, RoutePlacement, AtlasHostRuntimeOptions, AtlasLoaderOptions (+17 more)

### Community 37 - "Community 37"
Cohesion: 0.07
Nodes (27): action, default_icon, default_popup, default_title, background, service_worker, type, content_scripts (+19 more)

### Community 38 - "Community 38"
Cohesion: 0.07
Nodes (27): compilerOptions, baseUrl, composite, declaration, declarationMap, exactOptionalPropertyTypes, experimentalDecorators, lib (+19 more)

### Community 39 - "Community 39"
Cohesion: 0.11
Nodes (21): ColumbusManifest, createStorage(), createStorageArea(), InterceptorScenario, isColumbusManifest(), isRecord(), jsonResponse(), readColumbusFile() (+13 more)

### Community 40 - "Community 40"
Cohesion: 0.08
Nodes (46): AtlasBuildResult, AtlasPublicationLease, AtlasPublicationStorage, createPublicationStorage(), environmentBoolean(), storageFromEnvironment(), artifactIndexPath(), artifactPrefix() (+38 more)

### Community 41 - "Community 41"
Cohesion: 0.08
Nodes (25): apps/**/*.driver.ts, apps/**/*.specs.ts, jest, node_modules, packages/**/*.driver.ts, packages/**/*.specs.ts, playwright.config.ts, scripts/**/*.driver.ts (+17 more)

### Community 42 - "generate-files.ts"
Cohesion: 0.13
Nodes (26): AtlasAppIndex, AtlasArtifactIndex, AtlasArtifactManifestBase, AtlasAppConfig, AtlasBaseConfig, AtlasHostConfig, AtlasRouteMount, AtlasSlotMount (+18 more)

### Community 43 - "Community 43"
Cohesion: 0.16
Nodes (16): AtlasDevBuildService, AtlasDevService, browserOpenCommand(), closeServer(), frameworkServerArguments(), hostClientPortFallback(), isBaseHostUrl(), logHostViewUrl() (+8 more)

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
Cohesion: 0.12
Nodes (21): App(), ArtifactConfigurationPage(), ArtifactConfigurationLocationState, useArtifactConfiguration(), ArtifactsOverridesPage(), ArtifactName(), ArtifactOverrideActions(), ArtifactOverrideToggle() (+13 more)

### Community 49 - "Community 49"
Cohesion: 0.20
Nodes (11): assertAppConfig(), AtlasBuildService, buildTimestamp(), discoverStylesheets(), findArtifactRoot(), findArtifactRootIfPresent(), hashArtifactDirectory(), isAtlasBuildMetadata() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.09
Nodes (21): compilerOptions, composite, declaration, declarationMap, exactOptionalPropertyTypes, lib, module, moduleResolution (+13 more)

### Community 51 - "Community 51"
Cohesion: 0.14
Nodes (20): BadgeCountMessage, createLoadedHost(), HostLoadResult, loadCachedPopupHost(), PopupHostContext, PopupHostContextValue, AtlasHostData, getArtifactKey() (+12 more)

### Community 52 - "Community 52"
Cohesion: 0.07
Nodes (30): Bootstrap changed but platform did not roll out, Bootstrap deployment, Catalog missing an app, Choose a versioning policy, CORS, Credentials, Custom publication behavior, Deployment model (+22 more)

### Community 53 - "Community 53"
Cohesion: 0.13
Nodes (17): artifacts, atlasPackages, buildProject(), dependencyOverrides(), execute, installDependencies(), packageManager, packageManagerSpecification() (+9 more)

### Community 54 - "generate-angular.ts"
Cohesion: 0.25
Nodes (12): addUniquePolyfill(), asObject(), ensureAngularFederationPolyfills(), ensureAngularNativeFederationTargets(), ensureAngularWorkspaceFederationConfig(), isNativeFederationTarget(), ProjectType, retargetAngularBuildReference() (+4 more)

### Community 55 - "Community 55"
Cohesion: 0.14
Nodes (30): loadPopupHost(), createOverrideDocument(), disabledOverridesKey(), DisabledOverrideStorageLocation, errorMessage(), findAtlasHostTab(), hasTabId(), InspectableTab (+22 more)

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

### Community 60 - "Community 60"
Cohesion: 0.20
Nodes (12): AtlasArtifactOverride, AtlasExtensionManifest, AtlasOverrideDocument, AtlasReleaseChannel, AtlasRuntimeError, channelRank(), uniqueVersions(), installPage() (+4 more)

### Community 61 - "readAngularProjectPort"
Cohesion: 0.40
Nodes (5): Angular Assets And Styles, App Domain, Deployment Domain, Host Domain, Monorepos

### Community 62 - "Community 62"
Cohesion: 0.17
Nodes (12): 1. Create and push a branch, 2. Open the pull request, 3. Push more commits, 4. Merge or close the PR, 5. Reconcile nightly, Cache and deletion behavior, Freshness check, Lifecycle at a glance (+4 more)

### Community 63 - "Community 63"
Cohesion: 0.16
Nodes (15): BrowserStorage, isRecord(), readOverride(), restrictExtensionHosts(), StoredOverrideDocument, builtExtensionPath, createTestExtension(), ExtensionSession (+7 more)

### Community 64 - "Community 64"
Cohesion: 0.22
Nodes (11): ArtifactConfigurationActions(), ArtifactConfigurationActionsProps, BrowserOverrideScopePicker(), ScopePickerProps, OverrideRadioCard(), OverrideRadioCardProps, OverridesSelectionForm(), OverridesSelectionFormProps (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.19
Nodes (16): appendEntries(), COMMAND_ALIASES, COMMAND_HELP, CommandHelp, HelpEntry, ROOT_COMMANDS, ROOT_EXAMPLES, formatCommandHelp() (+8 more)

### Community 66 - "Community 66"
Cohesion: 0.11
Nodes (18): compilerOptions, composite, declaration, declarationMap, exactOptionalPropertyTypes, lib, module, moduleResolution (+10 more)

### Community 67 - "Community 67"
Cohesion: 0.16
Nodes (19): PopupHostProvider(), PopupOverridesContext, PopupOverridesContextValue, PopupOverridesProvider(), PopupSessionContext, PopupSessionContextValue, PopupSessionProvider(), usePopupSession() (+11 more)

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
Cohesion: 0.18
Nodes (19): OverrideVersionDropdown(), VersionDropdownProps, versionOptionLabel(), useArtifacts(), supportsHost(), versionKey(), artifactSourceDescription(), baseUrlFromRemoteEntry() (+11 more)

### Community 73 - "Community 73"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 74 - "AtlasManifest"
Cohesion: 0.29
Nodes (7): Before a Pull Request, Contributing to Atlas, Documentation, File Extensions, Releases, Repository Layout, Setup

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
Nodes (16): default, types, exports, ./angular, ./host, ./lifecycle, ./navigation, ./overlay (+8 more)

### Community 82 - "Community 82"
Cohesion: 0.18
Nodes (15): addBrokenRoute(), addSecondCatalogRelease(), addVersionFixtures(), artifacts, buildBootstrap(), cdn, createDistinctArtifact(), createExternalWidgetRegistry() (+7 more)

### Community 83 - "Community 83"
Cohesion: 0.08
Nodes (23): BrowserWindowLike, createBrowserNavigation(), AtlasAppContext, appendQueryValue(), matchRoutePart(), matchRoutePattern(), normalizeBasePath(), parseQuery() (+15 more)

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
Cohesion: 0.13
Nodes (14): action, chrome, InjectionResult, onRemoved, onUpdated, runtime, runtime.onInstalled, runtime.onMessage (+6 more)

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
Cohesion: 0.06
Nodes (59): Injectable, AtlasDefaultHostRouteComponent, AtlasNavigationItemsService, HostOptions, startHost(), syncAngularRouterWithBrowserUrl(), Component, emitHostError() (+51 more)

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
Nodes (5): App Domain, Deployment Domain, Host Domain, Monorepos, React Assets And Styles

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
Cohesion: 0.18
Nodes (17): BadgeRefreshDependencies, countDevSessionOverrides(), CountDevSessionOverridesOptions, createBadgeRefresher(), DevSessionBadgeState, fetchAtlasConfig(), isLoopbackBadgeHost(), isOverrideDocument() (+9 more)

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
Cohesion: 0.07
Nodes (27): AppBootstrap, createExportedWidget(), defineExportedWidget(), AtlasAppMountRequest, AtlasAppMountResult, AtlasExportedWidgetMountRequest, AtlasExportedWidgetMountResult, AppOptions (+19 more)

### Community 123 - "Manifests"
Cohesion: 0.17
Nodes (29): affectedHostIds(), artifactKey(), assertArtifactManifest(), assertSafeRegistryId(), assertStaticRegistry(), AtlasRegistryResult, compareArtifactIdentity(), compareNewestFirst() (+21 more)

### Community 124 - "Community 124"
Cohesion: 0.10
Nodes (9): { createAngularFederationConfig }, { createAngularFederationConfig }, { createAngularFederationConfig }, AtlasVitePlugin, executeFile, factoryPath, federationExposes(), Middleware (+1 more)

### Community 125 - "Community 125"
Cohesion: 0.38
Nodes (4): frameworkApis, readSdkPackage(), SdkPackage, CustomerHostSdk

### Community 126 - "Community 126"
Cohesion: 0.18
Nodes (11): devDependencies, @angular/cli, @angular/compiler-cli, @angular-devkit/build-angular, @types/node, typescript, @angular/cli, @angular/compiler-cli (+3 more)

### Community 127 - "Community 127"
Cohesion: 0.47
Nodes (5): docker(), execute, requireOk(), root, waitForHealth()

### Community 128 - "Community 128"
Cohesion: 0.67
Nodes (3): repository, type, url

### Community 130 - "Testing The Atlas Repository"
Cohesion: 0.50
Nodes (4): CI, Deployment E2E, Faster Browser Iteration, Testing The Atlas Repository

### Community 131 - "Community 131"
Cohesion: 0.26
Nodes (12): asStringRecord(), DEPENDENCY_FIELDS, dependencyDeclared(), DependencyField, dependencyManifestPath(), existingFrameworkVersionInfo(), frameworkPrimaryDependency(), isFrameworkManagedDependency() (+4 more)

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
Cohesion: 0.33
Nodes (6): files, dist/**/*.d.ts, dist/**/*.js, federation-config.cjs, federation-config.d.cts, federation-config.mjs

### Community 150 - "Community 150"
Cohesion: 0.50
Nodes (4): app, typescript, keywords, sdk

### Community 151 - "Community 151"
Cohesion: 0.50
Nodes (4): repository, directory, type, url

### Community 152 - "Community 152"
Cohesion: 0.16
Nodes (14): createReleaseWorkspace(), packageDirectories, writeJson(), main(), nextVersion(), prepareRelease(), releaseTypes, root (+6 more)

### Community 154 - "Community 154"
Cohesion: 0.17
Nodes (20): compileAtlasConfig(), compileAtlasConfigFile(), compiledAtlasConfigExists(), findCompilerConfig(), formatDiagnostics(), formatHelp(), cliVersion(), configuredArtifactIds() (+12 more)

### Community 155 - "readAngularProjectPort"
Cohesion: 0.30
Nodes (6): assertAtlasManifest(), AtlasValidationError, formatAtlasValidationMessage(), AtlasValidationIssue, validateAtlasHostCatalog(), validateAtlasManifest()

### Community 156 - "Community 156"
Cohesion: 0.67
Nodes (3): files, dist/**/*.d.ts, dist/**/*.js

### Community 158 - "Community 158"
Cohesion: 0.67
Nodes (3): files, dist/**/*.d.ts, dist/**/*.js

### Community 159 - "env.ts"
Cohesion: 0.46
Nodes (7): formatEnvValue(), isMissingFileError(), loadEnvFile(), loadEnvFiles(), parseEnvLine(), parseEnvValue(), saveWorkspaceLocalEnv()

### Community 160 - "Community 160"
Cohesion: 0.06
Nodes (53): AtlasHostMountState, createMountBoundary(), createRoutePlacementPlan(), createRouteTitleController(), createWidgetCard(), createWidgetLoader(), defaultManifestTrustPolicy(), findDefaultBasePath() (+45 more)

### Community 161 - "Community 161"
Cohesion: 0.20
Nodes (10): Angular Adapter, Contracts, Framework API vocabulary, Lifecycle, Navigation, Public API, React Adapter, Runtime (+2 more)

### Community 163 - "Community 163"
Cohesion: 0.20
Nodes (10): Apps, Architecture, Browser loader, Deliberate limits, Host client, One selection model, Release data flow, Rollback boundaries (+2 more)

### Community 164 - "Community 164"
Cohesion: 0.50
Nodes (3): ReactHostViteConfigOptions, ReactViteConfigOptions, ReactWidgetEntry

### Community 166 - "Community 166"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: when running apps locally why do I need to specify both host url and id? isn't url enough?, Source Nodes

### Community 167 - "Community 167"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: Can Atlas infer host id from a configured host URL when an app declares multiple hosts?, Source Nodes

### Community 169 - "Community 169"
Cohesion: 0.40
Nodes (5): Angular Project Guide, App Files, Choose Your Role, Host Files, Task Guides

### Community 172 - "Build A React App"
Cohesion: 0.67
Nodes (3): ./federation, default, types

### Community 177 - "atlas-host.specs.ts"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: columbus should allow any url its an internal extension, Source Nodes

### Community 183 - "SDK Reference"
Cohesion: 0.20
Nodes (10): `@atlas/runtime`, `@atlas/schema`, `@atlas/sdk/host`, `@atlas/sdk/overlay`, Events between apps, Framework Adapters, Loading and failure UI, Runtime Observability (+2 more)

### Community 184 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 185 - "Host bootstrap"
Cohesion: 0.06
Nodes (20): ATLAS_APP_CONTEXT, ATLAS_SDK, AtlasSdk, injectAppLoaded(), injectAtlasAppContext(), injectAtlasSdk(), createLocationStrategy(), notifyPopState() (+12 more)

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
Cohesion: 0.15
Nodes (11): AppReadiness, AtlasMountedApp, AtlasRuntimeController, createAppReadiness(), createLoadingEmitter(), createRuntimeMount(), hostPlacements(), placementKey() (+3 more)

### Community 191 - "Angular Routing"
Cohesion: 0.25
Nodes (8): Angular Routing, App Domain, Common Mistakes, Cross-App Navigation, Deployment Domain, Host Domain, How The Host Chooses An App, Inner Angular Routes

### Community 192 - "Angular SDK"
Cohesion: 0.67
Nodes (3): ./react, default, types

### Community 194 - "@angular-architects/native-federation"
Cohesion: 0.20
Nodes (17): AtlasPublicationStorageSource, isPublicationStorage(), AtlasPublishOptions, AtlasPublishConfig, AtlasPullRequestLookup, AtlasPullRequestResolver, AtlasPullRequestStatus, defineAtlasPublishConfig() (+9 more)

### Community 195 - "React Routing"
Cohesion: 0.25
Nodes (8): App Domain, Common Mistakes, Cross-App Navigation, Deployment Domain, Host Domain, How The Host Chooses An App, Inner React Routes, React Routing

### Community 196 - "React SDK"
Cohesion: 0.25
Nodes (8): App Domain, Events, Host Domain, Host-Owned UI, Loading And Readiness, Navigation, React SDK, Testing

### Community 198 - "Documentation Guidelines"
Cohesion: 0.29
Nodes (7): Choose One Page Type, Do, Do Not, Documentation Guidelines, Keep One Source Of Truth, Review Checklist, Write For One Audience And Outcome

### Community 199 - "Atlas Overview"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: how can I serve columbus locally so I can develop without the need to rebuild and install every time, Source Nodes

### Community 200 - "publishConfig"
Cohesion: 0.14
Nodes (10): CliArguments, AtlasBootstrapBuildResult, AtlasBootstrapService, BootstrapBuildService, bootstrapDigest(), assertHostConfig(), createHostRuntimeConfig(), isLoopbackUrl() (+2 more)

### Community 201 - "Atlas Documentation"
Cohesion: 0.29
Nodes (7): Atlas Documentation, Build Or Change Something, Learn Atlas In Order, Look Up Exact Contracts, Maintain Atlas Itself, Supported Scope, Understand Why Atlas Works This Way

### Community 203 - "Atlas Columbus Extension"
Cohesion: 0.33
Nodes (5): Atlas Columbus Extension, Build And Install, Troubleshooting, Use, Verification

### Community 204 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 205 - ".run"
Cohesion: 0.22
Nodes (9): Custom adapters, Lease safety, Mutable and immutable objects, Publication transaction, Registry selection, Rollback, Static registry, Storage configuration (+1 more)

### Community 206 - "Consumer Testing"
Cohesion: 0.33
Nodes (6): App Domain, Consumer Testing, Deployment Domain, Host Domain, Local Integration, What To Test

### Community 207 - "widget-registry.ts"
Cohesion: 0.17
Nodes (20): AtlasDevSessionDocument, assertRegistry(), assertWidgetId(), compareNewestFirst(), createRegistryWidgetResolver(), fetchRegistry(), isRecord(), LazyRegistry (+12 more)

### Community 208 - "scripts"
Cohesion: 0.20
Nodes (9): name, private, scripts, atlas:bootstrap, atlas:config, atlas:publish, build, dev (+1 more)

### Community 209 - "@atlas/cli"
Cohesion: 0.33
Nodes (5): @atlas/cli, Commands, Install, Storage, Workspace integration

### Community 210 - "Atlas"
Cohesion: 0.40
Nodes (5): App Files, Choose Your Role, Host Files, React Project Guide, Task Guides

### Community 213 - "EmptyHostDataState.tsx"
Cohesion: 0.14
Nodes (18): mount(), mapWithConcurrency(), artifactDirectoryUrl(), AtlasFederationAdapter, createNativeFederationImporters(), createTrustedNativeFederationImporters(), federationRemoteName(), hasMountFunction() (+10 more)

### Community 214 - "generate-overlay.ts"
Cohesion: 0.33
Nodes (6): 1. Generate, 2. Declare Placement, 3. Build Feature UI, 4. Run Inside Host, 5. Test And Continue, Build A React App

### Community 215 - "react-context.ts"
Cohesion: 0.08
Nodes (30): AtlasEventBus, AtlasEventMap, createAtlasEventBus(), EventKey, notifyListener(), StoredEventListener, AtlasFetchHttpClient, AtlasHttpClientInput (+22 more)

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

### Community 226 - "Angular Assets And Styles"
Cohesion: 0.50
Nodes (7): createManifestFromConfig(), identifierFromRoute(), identifierFromSlot(), placements(), routePlacementId(), slotPlacementId(), supportedHosts()

### Community 232 - "publication-context.ts"
Cohesion: 0.20
Nodes (21): AtlasArtifactManifest, discoverExportedWidgets(), gitOutput(), inferredTagVersion(), isAtlasConfig(), isNodeError(), isWidgetConfig(), loadWidgetConfig() (+13 more)

### Community 235 - "Angular Troubleshooting"
Cohesion: 0.25
Nodes (8): Angular Compiler Rejects `emitDeclarationOnly`, Angular Remote Entry Does Not Load, Angular Troubleshooting, Host APIs Are Missing, Inner Routing Escapes The App, Install Fails With Peer Conflicts, Spinner Never Disappears, The App Does Not Load

### Community 239 - ".writeNxProject"
Cohesion: 0.15
Nodes (4): AtlasGenerateService, availableAppsMessage(), AtlasNxProjectType, AtlasWorkspace

### Community 246 - "bootstrap.ts"
Cohesion: 0.27
Nodes (7): AppComponent, Component, bootstrap(), DemoRouteAnchorComponent, HostMountRequest, Component, mount()

### Community 247 - "interaction.ts"
Cohesion: 0.16
Nodes (7): AtlasInvocation, resolveInvocation(), title(), style(), TerminalPrompter, ui, defaultDevServerPort()

### Community 248 - "./federation"
Cohesion: 0.25
Nodes (12): ATLAS_BROWSER_LOADER, AtlasBootstrapFile, AtlasBootstrapOptions, createAtlasBootstrapFiles(), createBootstrapHtml(), createNginxConfig(), cspSources(), escapeHtml() (+4 more)

### Community 249 - "React Troubleshooting"
Cohesion: 0.20
Nodes (8): Asset URLs Break In Production, Host APIs Are Missing, Inner Routing Escapes The App, Install Fails With Peer Conflicts, React Troubleshooting, Spinner Never Disappears, The App Does Not Load, Troubleshooting

### Community 250 - "ui.ts"
Cohesion: 0.50
Nodes (4): ./federation-config, import, require, types

### Community 251 - "readAngularProjectPort"
Cohesion: 0.36
Nodes (9): asObject(), firstObjectValue(), objectValue(), parsePort(), readAngularProjectPort(), readConfiguredDevServerPort(), readPortFromTargets(), readTargetPort() (+1 more)

### Community 252 - "NetworkLimiter"
Cohesion: 0.25
Nodes (8): Angular SDK, App Domain, Events, Host Domain, Host-Owned UI, Loading And Readiness, Navigation, Testing

### Community 254 - "local-development.specs.ts"
Cohesion: 0.13
Nodes (9): contentType(), DirectoryPublicationStorage, isMutable(), metadata(), delay(), cases, LocalDevelopmentCase, stopAtlasDev() (+1 more)

### Community 255 - ".resolveHostId"
Cohesion: 0.32
Nodes (6): configuredHostIds(), hostIdFromRoute(), isHostConfig(), routeBasePaths(), routeMatchesPath(), supportsAnyHost()

### Community 256 - "Workspace integration"
Cohesion: 0.08
Nodes (22): Angular Generators, App Domain, Framework Versions, Host Domain, Widgets, Workspaces, Generators, App Domain (+14 more)

### Community 257 - "atlas-host.specs.ts"
Cohesion: 0.33
Nodes (4): ChromeMockOptions, hostData, installChromeMock(), MockTab

### Community 258 - "Atlas Overview"
Cohesion: 0.29
Nodes (7): App Domain, Atlas Overview, Deployment Domain, Host Domain, Learn Next, Mental Model, Vocabulary

### Community 259 - "Q: why am I seeing this error in columbus: Could not apply override; Custom URL must use localhost, 127.0.0.1, or [::1]."
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: why am I seeing this error in columbus: Could not apply override; Custom URL must use localhost, 127.0.0.1, or [::1]., Source Nodes

### Community 260 - "Exported Widgets"
Cohesion: 0.25
Nodes (8): Columbus, Common errors, Consume a widget, Create a widget, Exported Widgets, External-registry widgets, Performance and caching, Same-registry widgets

### Community 261 - "createTestElement"
Cohesion: 0.33
Nodes (7): createTestContainer(), createTestElement(), createHostStatusContainer(), createStylesheetDocument(), isTestStyleLink(), resolveRouteContainer(), resolveSlotContainer()

### Community 262 - "Q: default custom url in artifact configuration should not have predefined value but a http://localhost:4200 place holder"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: default custom url in artifact configuration should not have predefined value but a http://localhost:4200 place holder, Source Nodes

### Community 265 - "AtlasFederationAdapter"
Cohesion: 0.13
Nodes (28): loadAndMountHostCatalog(), assertLocalManifestUrls(), assertManifestAssetTrust(), assertManifestStylesTrust(), assertManifestSupportsHost(), assertTrustedAssetUrl(), AtlasBrowserOverrideOptions, defaultFetchJson() (+20 more)

### Community 266 - "Releasing Atlas packages"
Cohesion: 0.50
Nodes (4): Package checks, Prepare a release, Publishing policy, Releasing Atlas packages

### Community 269 - "Manifests"
Cohesion: 0.67
Nodes (3): App manifest, Host manifest, Manifests

## Knowledge Gaps
- **1408 isolated node(s):** `name`, `version`, `private`, `type`, `build` (+1403 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Work-memory lessons

**Preferred sources** — corroborated by past sessions; start here.
- `Columbus` (2× useful, score=1.999719303)
- `AtlasDevService` (2× useful, score=1.938987924)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createWidgetComponent()` connect `angular-generator.ts` to `Community 33`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `renderLoading()` connect `Community 33` to `angular-generator.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `AtlasManifest` connect `Community 36` to `Community 160`, `Community 98`, `Angular Assets And Styles`, `publication-context.ts`, `AtlasFederationAdapter`, `generate-files.ts`, `readAngularProjectPort`, `widget-registry.ts`, `Community 49`, `Community 83`, `Community 21`, `EmptyHostDataState.tsx`, `react-context.ts`, `angular-generator.ts`, `Manifests`, `native-federation.ts`, `Community 31`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _1408 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07238413760152891 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08412698412698413 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.08571428571428572 - nodes in this community are weakly interconnected._