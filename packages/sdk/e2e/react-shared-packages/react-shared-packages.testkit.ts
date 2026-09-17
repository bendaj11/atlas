/** Package layouts a shared dependency may ship in; each states the runtime exports the fallback must preserve. */
export interface PackageFixture {
  readonly manifest?: Readonly<Record<string, unknown>>;
  readonly files: Readonly<Record<string, string>>;
  readonly expected: Readonly<Record<string, unknown>>;
  readonly subpath?: string;
  readonly linked?: true;
  readonly transformedSource?: string;
}

const named = 'export const named = "named value";';
const commonjs = 'exports.named = "named value";';
const namedExports = { named: 'named value' };
export const PACKAGE_FIXTURES = {
  'ESM without a package type': {
    files: { 'index.js': named },
    expected: namedExports,
  },
  'declared ESM': {
    manifest: { type: 'module' },
    files: { 'index.js': named },
    expected: namedExports,
  },
  'an mjs entry': {
    manifest: { main: './index.mjs' },
    files: { 'index.mjs': named },
    expected: namedExports,
  },
  'named star reexports': {
    files: { 'index.js': 'export * from "./values.js";', 'values.js': named },
    expected: namedExports,
  },
  'a renamed default reexport': {
    files: {
      'index.js': 'export { default as named } from "./values.js";',
      'values.js': 'export default "named value";',
    },
    expected: namedExports,
  },
  'a real default export': {
    files: { 'index.js': 'export default "default value";' },
    expected: { default: 'default value' },
  },
  'a value reexported as default': {
    files: {
      'index.js': 'export { named as default } from "./values.js";',
      'values.js': named,
    },
    expected: { default: 'named value' },
  },
  'a namespace reexported as default': {
    files: {
      'index.js': 'export * as default from "./values.js";',
      'values.js': named,
    },
    expected: { default: namedExports },
  },
  'a type-only default export': {
    manifest: { main: './index.ts' },
    files: {
      'index.ts': `${named}\nexport type { Value as default } from "./types";`,
      'types.ts': 'export interface Value { value: string }',
    },
    expected: namedExports,
  },
  CommonJS: {
    files: { 'index.js': commonjs },
    expected: { ...namedExports, default: namedExports },
  },
  'a cjs entry': {
    manifest: { main: './index.cjs' },
    files: { 'index.cjs': commonjs },
    expected: { ...namedExports, default: namedExports },
  },
  'CommonJS reexports': {
    files: {
      'index.js': 'module.exports = require("./values.cjs");',
      'values.cjs': commonjs,
    },
    expected: { ...namedExports, default: namedExports },
  },
  'an import-only export map': {
    manifest: { exports: { '.': { import: './index.js' } } },
    files: { 'index.js': named },
    expected: namedExports,
  },
  'an import-only wildcard subpath': {
    manifest: { exports: { './features/*': { import: './*.js' } } },
    subpath: '/features/button',
    files: { 'button.js': named },
    expected: namedExports,
  },
  'different require and import entries': {
    manifest: {
      exports: { '.': { import: './browser.js', require: './index.cjs' } },
    },
    files: {
      'browser.js': named,
      'index.cjs': 'module.exports = "wrong require entry";',
    },
    expected: namedExports,
  },
  'a browser export condition': {
    manifest: {
      exports: { '.': { browser: './browser.js', default: './index.cjs' } },
    },
    files: {
      'browser.js': named,
      'index.cjs': 'module.exports = "wrong server entry";',
    },
    expected: namedExports,
  },
  'a module field beside CommonJS main': {
    manifest: { module: './browser.js' },
    files: {
      'browser.js': named,
      'index.js': 'module.exports = "wrong main entry";',
    },
    expected: namedExports,
  },
  'linked ESM without a package type': {
    linked: true,
    files: { 'index.js': named },
    expected: namedExports,
  },
  'linked CommonJS': {
    linked: true,
    files: { 'index.js': commonjs },
    expected: { ...namedExports, default: namedExports },
  },
  'a plugin adding a default': {
    files: { 'index.js': named },
    transformedSource: `${named}\nexport default "added default";`,
    expected: { ...namedExports, default: 'added default' },
  },
  'a plugin removing a default': {
    files: { 'index.js': 'export default "removed default";' },
    transformedSource: named,
    expected: namedExports,
  },
} satisfies Record<string, PackageFixture>;

export type PackageFormat = keyof typeof PACKAGE_FIXTURES;
