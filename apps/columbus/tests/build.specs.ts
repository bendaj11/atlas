import { expect, test } from '@jest/globals';
import {
  readColumbusFile,
  readColumbusJson,
  readColumbusManifest,
  runCatalogInterceptor,
} from './build.driver.js';

const ARTIFACTS_OVERRIDES_PAGE =
  'src/ArtifactsOverridesPage/ArtifactsOverridesPage.tsx';
const ARTIFACT_CONFIGURATION_PAGE =
  'src/ArtifactConfigurationPage/ArtifactConfigurationPage.tsx';
const ARTIFACT_CONFIGURATION_HOOK =
  'src/ArtifactConfigurationPage/useArtifactConfiguration/useArtifactConfiguration.ts';
const ARTIFACT_CONFIGURATION_ACTIONS =
  'src/ArtifactConfigurationPage/ArtifactConfigurationActions/ArtifactConfigurationActions.tsx';
const OVERRIDES_SELECTION_FORM =
  'src/ArtifactConfigurationPage/OverridesForm/OverridesSelectionForm.tsx';
const OVERRIDE_RADIO_CARD =
  'src/ArtifactConfigurationPage/OverridesForm/OverrideRadioCard/OverrideRadioCard.tsx';
const OVERRIDES_TABLE =
  'src/ArtifactsOverridesPage/ArtifactsOverridesTable/ArtifactsOverridesTable.tsx';
const OVERRIDE_ACTIONS =
  'src/ArtifactsOverridesPage/ArtifactsOverridesTable/ArtifactOverrideActions/ArtifactOverrideActions.tsx';
const OVERRIDE_TOGGLE =
  'src/ArtifactsOverridesPage/ArtifactsOverridesTable/ArtifactOverrideToggle/ArtifactOverrideToggle.tsx';
const OVERRIDE_VERSION =
  'src/ArtifactsOverridesPage/ArtifactsOverridesTable/ArtifactOverrideVersion/ArtifactOverrideVersion.tsx';
const OVERRIDES_TOOLBAR =
  'src/ArtifactsOverridesPage/ArtifactsOverridesTable/OverridesTableToolbar/OverridesTableToolbar.tsx';
const ARTIFACT_NAME =
  'src/ArtifactsOverridesPage/ArtifactsOverridesTable/ArtifactName/ArtifactName.tsx';
const USE_ARTIFACTS = 'src/ArtifactsOverridesPage/useArtifacts/useArtifacts.ts';

async function readColumbusSource(...paths: string[]): Promise<string> {
  return (await Promise.all(paths.map((path) => readColumbusFile(path)))).join(
    '\n',
  );
}

const productionHost = {
  schemaVersion: '1',
  kind: 'host',
  id: 'test-host',
  name: 'Test Host',
  version: '1.0.0',
  buildId: 'host-prod',
  channel: 'production',
  framework: 'react',
  remoteEntryUrl: 'https://cdn.test/host/remoteEntry.json',
  requiredHostSdkVersion: '*',
  supportedHosts: ['test-host'],
  placements: [],
};
const productionManifest = {
  schemaVersion: '1',
  kind: 'app',
  id: 'app',
  name: 'App',
  version: '1.0.0',
  buildId: 'prod',
  channel: 'production',
  framework: 'react',
  remoteEntryUrl: 'https://cdn.test/remoteEntry.json',
  requiredHostSdkVersion: '*',
  supportedHosts: ['test-host'],
  placements: [],
};
const localManifest = {
  ...productionManifest,
  version: '1.0.0-local',
  buildId: 'local',
  channel: 'local',
  remoteEntryUrl: 'http://127.0.0.1:4500/remoteEntry.json',
};

function catalog(apps: unknown[]): Record<string, unknown> {
  return {
    schemaVersion: '1',
    hostId: 'test-host',
    revision: 'test',
    generatedAt: '2026-01-01T00:00:00.000Z',
    host: productionHost,
    apps,
  };
}

function devSession(
  manifests: Array<typeof localManifest>,
): Record<string, unknown> {
  return {
    schemaVersion: '1',
    hostId: 'test-host',
    catalog: catalog(manifests),
    overrides: manifests.map((manifest) => ({ appId: manifest.id, manifest })),
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('Columbus extension build is Manifest V3 with local dev interception', async () => {
  const manifest = await readColumbusManifest();
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.minimum_chrome_version).toBe('111');
  expect(manifest.permissions).toStrictEqual([
    'activeTab',
    'scripting',
    'storage',
  ]);
  expect(manifest.host_permissions).toStrictEqual([
    'http://localhost/*',
    'http://127.0.0.1/*',
  ]);
  expect(manifest.content_scripts[0].run_at).toBe('document_start');
  expect(manifest.content_scripts[0].world).toBe('MAIN');
  expect(manifest.content_scripts[0].matches).toStrictEqual([
    'http://*/*',
    'https://*/*',
  ]);
  expect(manifest.content_scripts[0].js).toStrictEqual(['content-script.js']);
  expect(manifest.content_scripts[1].run_at).toBe('document_idle');
  expect(manifest.content_scripts[1].matches).toStrictEqual([
    'http://*/*',
    'https://*/*',
  ]);
  expect(manifest.content_scripts[1].js).toStrictEqual(['badge-script.js']);
  expect(manifest.action.default_popup).toBe('popup.html');
  expect(manifest.action.default_icon).toStrictEqual({
    16: 'icons/atlas-16.png',
    32: 'icons/atlas-32.png',
  });
  expect(manifest.icons).toStrictEqual({
    16: 'icons/atlas-16.png',
    32: 'icons/atlas-32.png',
    48: 'icons/atlas-48.png',
    128: 'icons/atlas-128.png',
  });
  expect(manifest.background.service_worker).toBe('background.js');
});

test('Columbus typecheck cannot overwrite the bundled extension', async () => {
  const packageJson = (await readColumbusJson('package.json')) as {
    scripts: { typecheck: string };
  };

  expect(packageJson.scripts.typecheck).toContain('--noEmit');
});

test('Columbus extension intercepts Atlas catalogs for local dev sessions', async () => {
  const source = await readColumbusFile('dist/content-script.js');
  const sourceModule = await readColumbusFile('src/content-script.ts');
  expect(source).toMatch(/atlas\.dev-session\.json/);
  expect(source).toMatch(/hosts\\\/\(.+catalog\\\.json/);
  expect(source).toMatch(/\.ok/);
  expect(source).toMatch(/void 0/);
  expect(source).toMatch(/window\.fetch/);
  expect(source).toMatch(/overrides\.filter/);
  expect(source).toMatch(/decodeURIComponent/);
  expect(source).toMatch(/\.hostId!==/);
  expect(source).toMatch(/searchParams\.set\("hostId"/);
  expect(source).not.toMatch(/devSessions=new Map/);
  expect(source).toMatch(/atlas\.disabled-local-apps\./);
  expect(sourceModule).toMatch(/enabledOverrides/);
  expect(sourceModule).toMatch(/sessionStorage\.getItem/);
  expect(sourceModule).toMatch(/allowCustomOverrides/);
  expect(sourceModule).toMatch(/isDevSession/);
  expect(sourceModule).toMatch(/manifest\.channel !== "local"/);
});

test('disabled local override falls back to production manifest', async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    disabledAppIds: ['app'],
    localDevelopmentIntent: true,
  });
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([
    productionManifest,
  ]);
});

test('disabled local-only app is removed from local catalog', async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([localManifest]),
    devSession: devSession([localManifest]),
    disabledAppIds: ['app'],
    localDevelopmentIntent: true,
  });
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([]);
});

test('host override policy prevents dev-session interception', async () => {
  const result = await runCatalogInterceptor({
    allowCustomOverrides: false,
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    localDevelopmentIntent: true,
  });
  expect(result.devSessionRequests).toBe(0);
});

test('override-enabled production host discovers a matching local dev session without URL parameters', async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
  });
  expect(result.devSessionRequests).toBe(1);
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([
    localManifest,
  ]);
  expect(result.storedOverrides).toMatchObject({
    hostId: 'test-host',
    overrides: [{ appId: 'app', manifest: localManifest, reason: 'local' }],
  });
  expect(result.storedOverrideScope).toBe('all');
});

test('Atlas dev session replaces a stale custom override', async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    localDevelopmentIntent: true,
  });

  expect(result.storedOverrides).toMatchObject({
    overrides: [{ appId: 'app', manifest: localManifest }],
  });
});

test('Atlas dev session preserves an explicit historical override', async () => {
  const historicalManifest = {
    ...productionManifest,
    version: '0.9.0',
    buildId: 'historical',
  };
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    localDevelopmentIntent: true,
    storedOverrideDocument: {
      schemaVersion: '1',
      hostId: 'test-host',
      overrides: [
        {
          appId: 'app',
          manifest: historicalManifest,
          reason: 'historical',
        },
      ],
      generatedAt: '2026-01-01T00:00:00.000Z',
    },
  });

  expect(result.storedOverrides).toMatchObject({
    overrides: [
      {
        appId: 'app',
        manifest: historicalManifest,
        reason: 'historical',
      },
    ],
  });
});

test('malformed dev session leaves the production catalog unchanged', async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: {
      ...devSession([localManifest]),
      overrides: [{ appId: 'app', manifest: { id: 'app' } }],
    },
  });

  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([
    productionManifest,
  ]);
  expect(result.storedOverrides).toBeUndefined();
});

test('loopback host keeps automatic local dev-session discovery', async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    pageHostname: '127.0.0.1',
  });
  expect(result.devSessionRequests).toBe(1);
  expect((result.catalog as { apps: unknown[] }).apps).toStrictEqual([
    localManifest,
  ]);
  expect(result.storedOverrideScope).toBe('all');
});

test('automatic local dev-session discovery preserves explicit tab scope', async () => {
  const result = await runCatalogInterceptor({
    catalog: catalog([productionManifest]),
    devSession: devSession([localManifest]),
    localDevelopmentIntent: true,
    localDevelopmentScope: 'tab',
  });
  expect(result.storedOverrideScope).toBe('tab');
});

test('Columbus extension keeps persisted overrides as fallback without hardcoded hosts', async () => {
  const source = await readColumbusFile('dist/popup.js');
  const hostSource = await readColumbusFile('src/popup/inspect-atlas-host.ts');
  const constants = await readColumbusFile('src/popup/constants.ts');
  expect(constants).toMatch(/atlas\.runtime-overrides/);
  expect(hostSource).toMatch(
    /manifest\.kind === ['"]host['"] \? ['"]hosts['"] : ['"]apps['"]/,
  );
  expect(source).toMatch(/index\.json/);
  expect(source).not.toMatch(/demo-angular-host|localhost:4300/);
  expect(source).toMatch(/sessionStorage/);
  expect(source).toMatch(/localStorage/);
});

test('Columbus extension keeps the override count badge synced from pages', async () => {
  const background = await readColumbusFile('dist/background.js');
  const badgeScript = await readColumbusFile('dist/badge-script.js');
  expect(background).toMatch(/setBadgeBackgroundColor/);
  expect(background).toMatch(/setBadgeTextColor/);
  expect(background).toMatch(/atlas\.override-count/);
  expect(badgeScript).toMatch(/atlas\.runtime-overrides/);
  expect(badgeScript).toMatch(/atlas\.overrides/);
  expect(badgeScript).toMatch(/atlas\.runtime\.json/);
  expect(badgeScript).toMatch(/chrome\.storage\.local\.get/);
  expect(badgeScript).toMatch(/sendMessage/);
  expect(badgeScript).toMatch(/atlas\.dev-session\.json/);
  expect(badgeScript).toMatch(/atlas\.disabled-local-apps\./);
  expect(badgeScript).toMatch(/setInterval/);
  expect(badgeScript).not.toMatch(/^import/);
});

test('Columbus popup recognizes intercepted local manifests as enabled overrides', async () => {
  const source = await readColumbusFile('src/popup/inspect-atlas-host.ts');
  expect(source).toMatch(/manifest\.channel === ['"]local['"]/);
  expect(source).toMatch(/reason: ['"]local['"] as const/);
  expect(source).toMatch(/version\.channel === ['"]production['"]/);
  expect(source).toMatch(/catalog: productionCatalog/);
  expect(source).toMatch(/mergeOverrideDocuments\(/);
});

test('Columbus discovers and labels external widget providers', async () => {
  const host = await readColumbusFile('src/popup/inspect-atlas-host.ts');
  const table = await readColumbusFile(OVERRIDES_TABLE);
  const artifactsHook = await readColumbusFile(USE_ARTIFACTS);
  expect(host).toMatch(/externalRegistryUrls/);
  expect(host).toMatch(/externalAppsDependencies/);
  expect(host).toMatch(/registry\.json/);
  expect(host).toMatch(
    /createProductionCatalog\([\s\S]*catalog,[\s\S]*versions,[\s\S]*external\.providers/,
  );
  expect(artifactsHook).toMatch(/catalog\.widgetProviders/);
  expect(table).toMatch(/const artifacts = useArtifacts\(\)/);
});

test('Columbus popup delegates scrolling to the WDS page', async () => {
  const main = await readColumbusFile('src/main.tsx');
  const popup = await readColumbusFile('src/App.tsx');
  const dashboard = await readColumbusFile(ARTIFACTS_OVERRIDES_PAGE);
  const provider = await readColumbusFile('src/popup/PopupProvider.tsx');
  const styles = await readColumbusFile('src/popup.css');
  expect(main).toMatch(/<PopupProvider>/);
  expect(provider).toMatch(/<WixDesignSystemProvider>/);
  expect(popup).not.toMatch(/WixDesignSystemProvider/);
  expect(popup).not.toMatch(/overflowY=/);
  expect(popup).not.toMatch(/<Box padding="16px" direction="vertical"/);
  expect(popup).not.toMatch(/popup-shell/);
  expect(dashboard).toMatch(/<Page height="100%" minWidth=\{0\}>/);
  expect(styles).toMatch(/height: 600px;/);
  expect(styles).not.toMatch(/\.popup-shell/);
});

test('Columbus popup uses a searchable WDS override table', async () => {
  const table = await readColumbusSource(
    OVERRIDES_TABLE,
    OVERRIDE_ACTIONS,
    OVERRIDE_VERSION,
    OVERRIDES_TOOLBAR,
  );
  expect(table).toMatch(/<Search/);
  expect(table).toMatch(/<Table[\s\S]*data=\{sortedArtifacts\}/);
  expect(table).toMatch(
    /Number\(right\.overrideEnabled\) - Number\(left\.overrideEnabled\)/,
  );
  expect(table).toMatch(
    /Number\(right\.canToggle\) - Number\(left\.canToggle\)/,
  );
  expect(table).toMatch(
    /artifact\.canToggle \? \([\s\S]*<ArtifactOverrideToggle/,
  );
  expect(table).toMatch(/<TableActionCell/);
  expect(table.indexOf("title: ''")).toBeLessThan(
    table.indexOf("title: 'Name'"),
  );
  expect(table.indexOf("title: 'Name'")).toBeLessThan(
    table.indexOf("title: 'Version'"),
  );
  expect(table).toMatch(/custom: 'Custom URL override'/);
  expect(table).toMatch(/pr: 'Pull request override'/);
  expect(table).toMatch(/production: 'Production override'/);
  expect(table).toMatch(/content=\{[\s\S]*<Text size="tiny" light>/);
  expect(table).not.toMatch(/<Badge/);
});

test('Columbus shows production versions without override tooltips', async () => {
  const version = await readColumbusFile(OVERRIDE_VERSION);

  expect(version).toMatch(/: artifact\.productionManifest\.version/);
  expect(version).toMatch(/if \(hasOverride\) return 'standard'/);
  expect(version).toMatch(/return 'disabled'/);
  expect(version).toMatch(/skin=\{getTextSkin\(\)\}/);
  expect(version).toMatch(/disabled=\{!artifact\.loadError && !hasOverride\}/);
});

test('Columbus shows artifact load failures in the version cell', async () => {
  const version = await readColumbusFile(OVERRIDE_VERSION);
  const artifacts = await readColumbusFile(USE_ARTIFACTS);

  expect(artifacts).toMatch(/error\.artifactId === id/);
  expect(artifacts).toMatch(/replace\(\/\\s\*\\bRetry\\b/);
  expect(artifacts).toMatch(/Check override URL and server/);
  expect(version).toMatch(/if \(artifact\.loadError\) return 'error'/);
  expect(version).toMatch(/skin=\{getTextSkin\(\)\}/);
  expect(version).toMatch(
    /artifact\.loadError \?\? OVERRIDE_TYPE_LABELS\[artifact\.overrideType\]/,
  );
});

test('Columbus labels custom URLs before comparing build identity', async () => {
  const source = await readColumbusFile('src/popup/manifest-utils.ts');
  const table = await readColumbusFile(OVERRIDE_VERSION);
  expect(source.indexOf("selectedManifest.channel === 'local'")).toBeLessThan(
    source.indexOf(
      'versionKey(selectedManifest) === versionKey(productionManifest)',
    ),
  );
  expect(table).toMatch(/custom: 'Custom URL override'/);
});

test('Columbus writes valid semantic versions and persists disabled toggle selections', async () => {
  const constants = await readColumbusFile('src/popup/constants.ts');
  const host = await readColumbusFile('src/popup/atlas-host.ts');
  const hostContext = await readColumbusFile(
    'src/context/PopupHostContext.tsx',
  );
  const overridesContext = await readColumbusFile(
    'src/context/PopupOverridesContext.tsx',
  );
  const persistence = await readColumbusFile('src/popup/persist-overrides.ts');
  const overrideManifests = await readColumbusFile(
    'src/popup/override-manifests.ts',
  );
  expect(constants).toMatch(/CUSTOM_VERSION = "0\.0\.0-local"/);
  expect(host).toMatch(/atlas\.disabled-overrides/);
  expect(host).toMatch(/readDisabledOverrides/);
  expect(host).toMatch(/writeDisabledOverrides/);
  expect(hostContext).toMatch(
    /const disabledOverrides = await readDisabledOverrides/,
  );
  expect(overridesContext).toMatch(/persistOverrideSession/);
  expect(persistence).toMatch(/await writeDisabledOverrides/);
  expect(overrideManifests).toMatch(/normalizeStoredManifest\(manifest\)/);
  expect(host).toMatch(/normalizeStoredManifest\(manifest\)/);
  expect(host).toMatch(/disabledAppIds/);
  expect(host).toMatch(/atlas\.disabled-local-apps\./);
  expect(hostContext).toMatch(/includeDisabledAppsInCatalog/);
  expect(host).not.toMatch(/disables host and app overrides/);
  expect(host).toMatch(/\.tab\.\$\{tabId\}/);
});

test('Columbus popup keeps product identity and actions in its page header', async () => {
  const dashboard = await readColumbusFile(ARTIFACTS_OVERRIDES_PAGE);
  expect(dashboard).toMatch(/<Page[\s\S]*<Page\.Header/);
  expect(dashboard).toMatch(/<Heading size="medium">Columbus<\/Heading>/);
  expect(dashboard).toMatch(/Inspect artifacts and manage runtime overrides/);
  expect(dashboard).not.toMatch(/hostData/);
  expect(dashboard).toMatch(/actionsBar=\{/);
  expect(dashboard).toMatch(/<Page\.Content>[\s\S]*<ArtifactsOverridesTable/);
  expect(dashboard).not.toMatch(/<Badge/);
});

test('Columbus keeps page shell visible while host data loads or fails', async () => {
  const app = await readColumbusFile('src/App.tsx');
  const page = await readColumbusFile(ARTIFACTS_OVERRIDES_PAGE);

  expect(app).toMatch(/<Routes>/);
  expect(app).not.toMatch(/shouldShowEmptyState|<EmptyState|<Loader/);
  expect(page).toMatch(/status === 'LOADING'[\s\S]*<Loader/);
  expect(page).toMatch(/status === 'ERROR'[\s\S]*<EmptyHostDataState/);
  expect(page).toMatch(/status === 'LOADED'[\s\S]*<ArtifactsOverridesTable/);
});

test('Columbus loads host data only when the popup mounts', async () => {
  const app = await readColumbusFile('src/App.tsx');

  expect(app).toMatch(
    /useEffect\(\(\) => \{[\s\S]*void loadHost\(\);[\s\S]*\}, \[\]\)/,
  );
  expect(app).not.toMatch(/\}, \[loadHost\]\)/);
});

test('Columbus labels the host artifact in the name column', async () => {
  const artifactName = await readColumbusFile(ARTIFACT_NAME);

  expect(artifactName).toMatch(/productionManifest\.kind === 'host'/);
  expect(artifactName).toMatch(
    /\{isHost && \([\s\S]*<Text size="tiny" skin="primary">[\s\S]*\(Host\)/,
  );
});

test('Columbus popup injects a self-contained Atlas host inspector', async () => {
  const hostSource = await readColumbusFile('src/popup/atlas-host.ts');
  const inspector = await readColumbusFile('src/popup/inspect-atlas-host.ts');
  expect(hostSource).toMatch(
    /func: inspectAtlasHost,\n\s+args: \[DOCUMENT_KEY\]/,
  );
  expect(inspector).toMatch(
    /export async function inspectAtlasHost\(documentKey: string\): Promise<HostData>/,
  );
  expect(inspector).not.toMatch(/artifactKey\(/);
  expect(inspector).not.toMatch(/^import (?!type)/m);
});

test('Columbus artifact editor uses WDS page layout with header actions', async () => {
  const editor = await readColumbusSource(
    ARTIFACT_CONFIGURATION_PAGE,
    ARTIFACT_CONFIGURATION_ACTIONS,
  );
  expect(editor).toMatch(/<Page minWidth=\{0\}>/);
  expect(editor).toMatch(/<Page\.Header[\s\S]*actionsBar=\{/);
  expect(editor).toMatch(/showBackButton/);
  expect(editor).toMatch(/Clear override[\s\S]*Cancel[\s\S]*Save/);
  expect(editor.match(/priority="secondary"/g)).toHaveLength(2);
  expect(editor).toMatch(/actionsBar=\{[\s\S]*<ArtifactConfigurationActions/);
  expect(editor).not.toMatch(/<Page\.Footer/);
  expect(editor).not.toMatch(/<Card/);
  expect(editor).not.toMatch(/<Divider/);
});

test('Columbus artifact editor labels each WDS radio option and its input together', async () => {
  const editor = await readColumbusSource(
    OVERRIDES_SELECTION_FORM,
    OVERRIDE_RADIO_CARD,
  );
  const popup = await readColumbusFile('src/App.tsx');
  expect(editor).toMatch(/<Radio/);
  expect(editor).toMatch(/checked=\{currentSelectedType === type\}/);
  expect(editor).not.toMatch(/content=\{\(/);
  expect(editor).toMatch(/Custom URL[\s\S]*<Input/);
  expect(editor).toMatch(/placeholder="http:\/\/localhost:4200"/);
  expect(editor).toMatch(/title="Production"/);
  expect(editor).toMatch(/title="PR"/);
  expect(popup).not.toMatch(/StatusCard/);
});

test('Columbus popup omits global status banners', async () => {
  const popup = await readColumbusFile('src/App.tsx');
  expect(popup).not.toMatch(
    /overrideStatus|override-error|Could not apply override|SectionHelper/,
  );
  expect(popup).not.toMatch(/host-warning|Host warning/);
});

test('Columbus tracks host and override lifecycles without busy or tone flags', async () => {
  const types = await readColumbusFile('src/popup/types.ts');
  const hostContext = await readColumbusFile(
    'src/context/PopupHostContext.tsx',
  );
  const overridesContext = await readColumbusFile(
    'src/context/PopupOverridesContext.tsx',
  );

  expect(types).toMatch(
    /HostStatus = 'RESTORING' \| 'LOADING' \| 'ERROR' \| 'LOADED'/,
  );
  expect(types).toMatch(/OverrideStatus = 'IDLE' \| 'APPLYING' \| 'ERROR'/);
  expect([types, hostContext, overridesContext].join('\n')).not.toMatch(
    /\b(busy|tone)\b/,
  );
  expect(hostContext).toMatch(/setStatus\('LOADING'\)/);
  expect(hostContext).toMatch(/setStatus\(result\.status\)/);
  expect(overridesContext).toMatch(/setStatus\('APPLYING'\)/);
});

test('Columbus popup omits host trust explanation', async () => {
  const dashboard = await readColumbusFile(ARTIFACTS_OVERRIDES_PAGE);
  expect(dashboard).not.toMatch(/selected host code controls/);
});

test('Columbus offers individual and global override clearing', async () => {
  const editor = await readColumbusSource(
    ARTIFACT_CONFIGURATION_PAGE,
    ARTIFACT_CONFIGURATION_ACTIONS,
    ARTIFACT_CONFIGURATION_HOOK,
  );
  const dashboard = await readColumbusFile(ARTIFACTS_OVERRIDES_PAGE);
  const table = await readColumbusFile(OVERRIDE_ACTIONS);
  const context = await readColumbusFile(
    'src/context/PopupOverridesContext.tsx',
  );
  const session = await readColumbusFile('src/popup/override-session.ts');
  expect(editor).toMatch(/Clear override/);
  expect(dashboard).toMatch(/prefixIcon=\{<Delete \/>\}/);
  expect(dashboard).toMatch(/>\s*Clear\s*<\/Button>/);
  expect(table).toMatch(/text: 'Clear'/);
  expect(table).toMatch(/text: 'Edit'/);
  expect(table).toMatch(/\.\.\.\(artifact\.canToggle/);
  expect(dashboard).not.toMatch(/Clear all overrides/);
  expect(session).toMatch(/activeOverrides: new Map\(\)/);
  expect(session).toMatch(/disabledOverrides: new Map\(\)/);
  expect(context).toMatch(/function clearOverride/);
  expect(dashboard).toMatch(/clearAllOverrides/);
  expect(table).toMatch(/clearOverride/);
  expect(editor).toMatch(/saveOverride/);
});

test('Columbus popup shares focused contexts without prop drilling', async () => {
  const main = await readColumbusFile('src/main.tsx');
  const provider = await readColumbusFile('src/popup/PopupProvider.tsx');
  const hostContext = await readColumbusFile(
    'src/context/PopupHostContext.tsx',
  );
  const sessionContext = await readColumbusFile(
    'src/context/PopupSessionContext.tsx',
  );
  const overridesContext = await readColumbusFile(
    'src/context/PopupOverridesContext.tsx',
  );
  const components = await Promise.all([
    readColumbusFile('src/App.tsx'),
    readColumbusFile(ARTIFACTS_OVERRIDES_PAGE),
    readColumbusFile(ARTIFACT_CONFIGURATION_PAGE),
    readColumbusFile(ARTIFACT_CONFIGURATION_HOOK),
    readColumbusFile(OVERRIDES_TABLE),
  ]);

  expect(main).toMatch(/<PopupProvider>/);
  expect(provider).toMatch(/<PopupSessionProvider>/);
  expect(provider).toMatch(/<PopupHostProvider>/);
  expect(provider).toMatch(/<PopupOverridesProvider>/);
  expect(provider).toMatch(/<MemoryRouter>/);
  expect(provider).not.toMatch(/NavigationProvider/);
  expect(hostContext).toMatch(
    /createContext<PopupHostContextValue \| undefined>/,
  );
  expect(hostContext).not.toMatch(/const PopupSessionContext/);
  expect(sessionContext).toMatch(
    /createContext<PopupSessionContextValue \| undefined>/,
  );
  expect(overridesContext).toMatch(/PopupOverridesContextValue \| undefined/);
  expect(overridesContext).not.toMatch(/artifacts: Artifact\[\]/);
  expect(components.join('\n')).toMatch(/useNavigate\(\)/);
  expect(components.join('\n')).toMatch(/useLocation\(\)/);
  expect(components.join('\n')).toMatch(/<Routes>/);
  expect(components.join('\n')).toMatch(/ARTIFACT_CONFIGURATION_ROUTE/);
  expect(components.join('\n')).toMatch(/usePopupHost\(\)/);
  expect(components.join('\n')).toMatch(/usePopupOverrides\(\)/);
  expect(components.join('\n')).toMatch(/usePopupSession\(\)/);
  expect(components.join('\n')).not.toMatch(
    /interface (ArtifactsOverridesPage|ArtifactConfigurationPage|OverrideTable)Props/,
  );
});

test('Columbus passes selected artifacts through router state', async () => {
  const actions = await readColumbusFile(OVERRIDE_ACTIONS);
  const configurationHook = await readColumbusFile(ARTIFACT_CONFIGURATION_HOOK);

  expect(actions).toMatch(
    /navigate\(ARTIFACT_CONFIGURATION_ROUTE,[\s\S]*state: \{ artifact \}/,
  );
  expect(configurationHook).toMatch(/useLocation\(\)/);
  expect(configurationHook).toMatch(/\?\.artifact/);
  expect(configurationHook).not.toMatch(/useParams/);
});

test('Columbus computes artifact ids once when creating artifacts', async () => {
  const artifactsHook = await readColumbusFile(USE_ARTIFACTS);
  const consumers = await readColumbusSource(
    ARTIFACT_CONFIGURATION_HOOK,
    OVERRIDE_ACTIONS,
    OVERRIDE_TOGGLE,
  );

  expect(artifactsHook).toMatch(/id = getArtifactKey/);
  expect(consumers).toMatch(/artifact\.id/);
  expect(consumers).not.toMatch(/getArtifactKey/);
});

test('Columbus reuses artifact types for selections, configuration, and props', async () => {
  const types = await readColumbusFile('src/popup/types.ts');

  expect(types).toMatch(/interface Artifact extends ArtifactSelection/);
  expect(types).toMatch(/interface ArtifactConfiguration[\s\S]*extends Pick</);
  expect(types).toMatch(/interface ArtifactProps[\s\S]*artifact: Artifact/);
  expect(types).not.toMatch(/SaveOverrideValue/);
});

test('Columbus uses React 19 with React Compiler instead of manual memoization', async () => {
  const packageJson = await readColumbusFile('package.json');
  const viteConfig = await readColumbusFile('vite.config.ts');
  const sourceFiles = await Promise.all([
    readColumbusFile('src/context/PopupHostContext.tsx'),
    readColumbusFile('src/context/PopupSessionContext.tsx'),
    readColumbusFile('src/context/PopupOverridesContext.tsx'),
    readColumbusFile(ARTIFACT_CONFIGURATION_HOOK),
    readColumbusFile(OVERRIDES_TABLE),
    readColumbusFile(OVERRIDE_ACTIONS),
    readColumbusFile(OVERRIDE_TOGGLE),
    readColumbusFile(USE_ARTIFACTS),
  ]);

  expect(packageJson).toMatch(/"react": "\^19\.2\.0"/);
  expect(packageJson).toMatch(/"react-dom": "\^19\.2\.0"/);
  expect(packageJson).toMatch(/"babel-plugin-react-compiler": "1\.0\.0"/);
  expect(viteConfig).toMatch(/'babel-plugin-react-compiler'/);
  expect(viteConfig).toMatch(/target: '19'/);
  expect(sourceFiles.join('\n')).not.toMatch(/\buse(Memo|Callback)\b/);
});

test('Columbus extension defaults to all tabs and offers current-tab scope', async () => {
  const source = await readColumbusFile('dist/popup.js');
  expect(source).toMatch(/All tabs/);
  expect(source).toMatch(/This tab/);
  expect(source).toMatch(/value:"all"/);
  expect(source).toMatch(/value:"tab"/);
});

test('Columbus extension can remove an all-tabs override and preserve a tab production choice', async () => {
  const source = await readColumbusFile('dist/popup.js');
  const hostSource = await readColumbusFile('src/popup/atlas-host.ts');
  expect(source).toMatch(/chrome\.storage\.local\.remove/);
  expect(hostSource).toMatch(/documentValue\.overrides\.length/);
  expect(hostSource).toMatch(/documentValue\.hostOverride/);
  expect(source).toMatch(/sessionStorage\.setItem/);
});
