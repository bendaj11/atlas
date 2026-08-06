import type { AtlasHostCatalog, AtlasHostRuntimeConfig } from '@atlas/schema';
import { showFatalError } from './fatal-error/fatal-error.js';
import { fetchJson } from './fetch-json/fetch-json.js';
import { loadHostModule } from './host-loader/host-loader.js';
import { installModuleShim } from './module-shim/module-shim.js';
import { applyOverrides } from './overrides/overrides.js';
import { validateCatalog } from './validation/validation.js';

async function start(): Promise<void> {
  await installModuleShim();

  const runtime = await fetchJson<AtlasHostRuntimeConfig>(
    '/atlas.runtime.json',
  );
  const catalog = await fetchJson<AtlasHostCatalog>(
    runtime.catalogUrl,
    runtime,
  );
  const effectiveCatalog = await applyOverrides(runtime, catalog);

  validateCatalog(runtime, effectiveCatalog);

  const root = document.getElementById('atlas-host-root');
  if (!root) throw new Error('Atlas host root is missing.');

  const module = await loadHostModule(effectiveCatalog.host, runtime);
  const entry = module.default?.mount ? module.default : module;
  if (typeof entry.mount !== 'function')
    throw new Error('Selected host client does not export mount(request).');

  root.replaceChildren();
  await entry.mount({
    container: root,
    runtimeConfig: runtime,
    catalog: effectiveCatalog,
  });
}

start().catch(showFatalError);
