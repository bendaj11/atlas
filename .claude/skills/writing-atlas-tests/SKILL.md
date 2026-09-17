---
name: writing-atlas-tests
description: Use when adding, changing, or migrating any Jest unit test, spec, driver, or testkit in the atlas monorepo (packages/*, apps/*, scripts/), including "add tests for X", "cover this function/hook/component", or fixing a failing *.specs.ts
---

# Writing Atlas Tests

Rules live in `AGENTS.md` → "TypeScript tests". This skill is the procedure that satisfies them. Read that section first; it is the completion gate, this is the path.

**Violating the letter of the rules is violating the spirit of the rules.** "Faster to ship" is not an exception.

## Workflow

1. **Locate the unit.** One source file = one spec. Spec goes next to it: `foo.ts` → `foo.specs.ts` (+ `foo.driver.ts`). Never in a central `tests/` dir.
2. **Decide driver.** A driver exists only for boundaries: mocks, storage, `chrome.*`, `fetch`, DOM, listeners registered at import. A unit with none of these (a pure function, however many cases) has no driver: the spec builds fixtures with the testkit and calls the function. The spec **always** invokes the unit under test itself, driver or not: `expect(uniqueVersions([first, other, first])).toStrictEqual([first, other])`, `await expect(readHostData()).rejects.toThrow('No Atlas host tab.')`. A driver member never wraps that call: no `get.uniqueVersionKeys()` that runs `uniqueVersions`, no `when.hostDataRead()` that stores `readHostData()` for a `get.result()`, no `try/catch` that stores an error for a `get.errorMessage()`. `given` arranges the boundary, `get` returns the mocks and boundary state (`sessionStorage`, `chrome` fakes) the spec asserts on, and `when` drives events into an entry script or a callback the unit registered (`messageReceived`, `tabUpdated`), never a plain call of an exported function.
3. **Write driver** (`*.driver.ts`, `.tsx` if it renders JSX): class with `given` (mocks and environment: queued mock values, storage, DOM, `chrome` fakes), `when` (events driven into an entry script or a rendered component; never a call of the exported function under test), `get` (the mocks and boundary state the spec asserts on; never the unit's return value). Shared factories live in `*.testkit.ts`, named `aThing()`/`anThing()` (`anAppManifest`, `aHostManifest`, `anArtifact`), `aThingsList()` for arrays. A factory fills every field it does not receive with a faker value; a union field is `faker.helpers.arrayElement(ALL_MEMBERS)`, never one fixed member. A field the factory must fix to mean anything (`kind`) belongs to a named wrapper (`anAppManifest` sets `kind: 'app'`); the generic base (`aManifest`) stays module-private so no spec can lean on its choice. Every `given` returns `this`. Every `when` returns `void` (or `Promise<void>`): a `when` is a terminal action, never a chain link. No return type annotations on `given`/`when`/`get` members: `this`, `void`, `Promise<void>` and the testkit or mock a `get` returns are all inferred (`cancelClicked: () => this.get.cancelButton().click()`, never `cancelClicked: async (): Promise<void> => { await ...; }`). Annotate only when inference fails or must widen (`let release: () => void = () => undefined`, `storage.json<Manifest>(...)` through the generic rather than the return). A member whose body is one expression is an expression arrow, never a block with a lone `await` or `return`. All arrangement lives here.
   - **WDS components** (`@wix/design-system`) are driven through their testkits: `import { XTestkit } from '@wix/design-system/dist/testkit/testing-library'`, keyed by `dataHook`. Put a `dataHook` on every WDS element a driver touches. `when.rendered` stores `render(...).baseElement` in `private baseElement!: Element` (definite assignment, no `undefined` guard: the testkit already throws when the element is missing); `get` builds the testkit with `wrapper: this.baseElement`. One `get` per testkit the driver uses, named after the testkit (`radio`, `input`, `dropdown`), never after the element it finds (`card`, `customUrlInput`, `prDropdown`): a name like `card` hides that the spec is reading a `RadioTestkit`, and a `get` per element multiplies getters that differ only in a string. When the driver reaches one element with that testkit, the `dataHook` is a literal inside the `get` and the `get` takes no argument: `get.dropdown: () => DropdownTestkit({ wrapper: this.baseElement, dataHook: 'override-version-dropdown' })`. In a driver that reaches several elements overall, a no-argument `get` carries the element in its name (`customUrlInput`, `saveButton`) so the bare testkit name does not claim to be the only one; a driver around a single element keeps the bare testkit name (`dropdown`, `radio`). When the driver reaches several elements with the same testkit, the `get` takes the `dataHook` from the caller: `get.radio: (dataHook: string) => RadioTestkit({ wrapper: this.baseElement, dataHook })`, and the string lives in the spec (`driver.get.radio('override-card-pr')`) or in the `when` that acts on it (`await this.get.radio(`override-card-${type}`).click()`); the driver never digests it into a domain lookup (`card(type)`). A `dataHook` is a constant, never a faker value: when the unit takes `dataHook` as a prop, `when.rendered` passes a fixed literal and the `get` holds the same literal; no `given.dataHook`. `baseElement`, not `container`: WDS popovers and dropdowns portal to `document.body`. Actions go through the testkit (`await this.get.radio(dataHook).click()`), observations too (`await driver.get.radio(dataHook).isChecked()`). `get` exposes the testkit object itself (`get.dropdown()`, `get.option(version)`), never a wrapper around one of its methods: `get.isOptionDisabled(version)` hides which element and which testkit call the spec is reading, `(await driver.get.option(version)).isDisabled()` shows both. When the lookup is async, bind it first: `const option = await driver.get.option(version); expect(await option.isDisabled()).toBe(true)`. The only `get` members that are not testkits are the mocks and plain values the unit returns. Never reach a WDS element with `screen.getByRole` / `userEvent`; those are for plain DOM only.
   - Pick the testkit method that states the behavior under test. A disabled control is asserted with `isDisabled()`, a selected radio with `isChecked()`, shown text with `getLabel()` / `getText()`; the callback mock is asserted only when the case is about the callback firing. `expect(mock).not.toHaveBeenCalled()` after a click on a disabled control proves nothing the testkit cannot state directly.
4. **Write spec** (`*.specs.ts`): shape below. Cover primary success + failure/rejection branches.
   - **Pins come from the source, not from a red test.** Before writing a fixture, list the unit's conditions (`&&`, `===`, `?.`, `switch`, early `return`). Each pinned field maps to one listed condition; a field with no condition stays random. Never add a pin to silence a failure: a failure after randomizing a factory means a condition was missed in the list, so go back to the source, find it, then pin and name it.
   - **The `describe`/`it` name states every pinned condition its cases share.** `deployed = anAppManifest({ channel: 'production' })` under `describe('when the deployed version is among the versions')` hides the channel condition; `when the deployed production version is among the production versions` states it. Re-read the name after every fixture change.
   - **A negative case pins the same conditions as its positive twin except the one under test.** `other` in a "not marked as deployed" case pins `channel: 'production'` so the only difference from `deployed` is the key; otherwise a random channel makes the case pass for the wrong reason.
5. **Run tests** from repo root. Package `test` scripts cannot be narrowed (extra patterns are OR-ed):
   ```bash
   node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.json --testPathPattern='packages/<pkg>/src/<file-stem>'
   ```
   A package with its own `jest.config.*` takes that file via `--config`.
   Then run the whole package once: `pnpm --filter @atlas/<pkg> test`.
6. **Audit before done.** Self-check below.

## Spec shape

```ts
describe('<exported symbol>', () => {
  let driver: FooDriver;

  beforeEach(() => {
    driver = new FooDriver();
  });

  describe('when <shared precondition>', () => {
    beforeEach(() => {
      driver.given.precondition();
    });

    it.each(INPUTS)('should <result> when input is %s', (input) => {
      driver.given.input(input).when.acted();

      expect(driver.get.result()).toBe(expected);
    });
  });
});
```

- `new XDriver()` only in top `beforeEach`. Never inside `it`.
- An `it` body has up to four segments, in this order, separated by exactly one blank line and with no blank line inside a segment: (1) fixtures and generated values (`const hostId = faker.string.uuid(); const version = anAppManifest({ supportedHosts: [hostId] })`), (2) setup: the `given` chain ending in its `when.rendered()` (or the single `when` for non-render units) in **one** statement, (3) actions: every further `when` (`await driver.when.opened(); await driver.when.versionChosen(version)`), one per line, (4) the single `expect`. A testkit lookup the `expect` needs (`const option = await driver.get.option(version)`) opens segment 4, directly above the `expect`. A segment the case does not need is omitted, never left as an empty line. A `describe` `beforeEach` follows the same segments: setup, blank line, actions.
- A shared `beforeEach` holds only setup that **every** case under it depends on. A `given` one sibling does not read is misleading setup for the others: `saveDisabled(false).clearDisabled(false).cancelDisabled(false)` above three click cases claims each click depends on all three flags, when the save click depends on `saveDisabled` alone. Cases whose setups merely overlap stay flat, each with its own `given` chain; group only when the prefix is identical **and** relevant to all.
- Two or more `it` blocks that share the same `given`/`when` prefix → nested `describe('when ...')` whose `beforeEach` runs that prefix once (`driver.when.rendered()`, `driver.given.errorMessage('Boom').when.rendered()`). Each `it` keeps only what differs (a further `when`, then `expect`). Never repeat `driver.when.rendered()` across sibling `it` blocks. Cases whose prefix is unique stay flat.
- `given` methods are plain state setters, agnostic to the test's intent: `given.session(undefined)`, `given.actionsDisabled(true)`. Never `given.noSession()` / `given.actionsDisabled()`. Intent lives in the `it` name.
- A value the case does not depend on is generated in the spec with `@faker-js/faker` and asserted back (`const name = faker.commerce.productName(); given.productionManifest(anAppManifest({ name })); expect(...).toBe(name)`). A literal in a spec claims the case needs exactly that value; a generated value proves passthrough. Pick the generator that matches the field's shape.
- A finite domain (union type, enum, fixed list) that the unit **branches on** is covered exhaustively: `it.each(ALL_MEMBERS)` over every member, never a single sample. Branching means production code has a distinct path per member (a `switch`, a lookup, a conditional render). If the unit only forwards the value (`onChange={(v) => onChange(v)}`, `value={selected}`), there is one behavior and one case: sample with `faker.helpers.arrayElement` or pick one literal. `it.each` over pairs/transitions of a forwarded value is overtesting; check the source before multiplying cases.
- Expectations are hard-coded literals (or the generated value from the same case). Never call production helpers (`getArtifactKey`, `versionKey`) in a spec or a driver to compute an expected value. A literal repeated across cases becomes a `const` in the narrowest `describe` that shares it.
- Key getters and givens by the object the spec created, not by an id: `given.catalogApp(orders)`, `get.artifactOf(orders)`, `expect(get.deployedManifests()).toEqual([host, orders])`. Ids appear only when the id itself is the behavior (`visibleAppIds(['orders'])`). Composite keys are built inside the driver, never typed in a spec.
- Pin every value you assert on through a `given` (`given.hostManifest(aHostManifest({ id: 'host' }))`), then assert the literal. `expect.any(String)` only when the value is truly irrelevant to the case.
- Never retype a driver default in the spec. A literal that lives in the driver (`key: 'orders-artifact'`, `anAppManifest({ name: 'Orders' })`) is not a `const` in the spec: either pin it through a `given` and assert the literal, or read it back through a `get` (`get.artifact()?.key`, `get.tabId()`). Driver defaults are always faker-generated.
- The driver never builds request or fixture data the spec also builds. A `when` takes the request from the spec (`when.messageReceived(LOAD_REQUEST)`); setup that the `when` needs (`sender`, urls) goes through `given`s the spec calls, not through a `when` that hardcodes it.
- `given` takes ready data, never builds it: `given.appManifest(anAppManifest({ name }))`, not `given.app({ name })`. Data comes from testkit factories in the spec. Name the given after the thing it sets (`appManifest`, `version`), not the test's concept.
- `get` holds only what a spec asserts on: mocks (`get.fetch()`, `get.writeHostDataCache()`), boundary state (`get.sessionStorageItem(key)`, `get.page()`), testkits. Never a value computed by calling the unit (`get.uniqueVersionKeys()`), never a stored result of a `when` that called the unit (`get.result()`), never a stored error (`get.errorMessage()`): the spec calls the unit and asserts on the returned promise (`await expect(fn()).rejects.toThrow('...')`, `expect(await fn()).toStrictEqual(...)`). Helpers other driver members need (`container()`, element lookups feeding testkits) are `private` methods on the class, not `get` entries. Every `get`/`when` must have a spec caller; the coverage audit treats an uncalled one as a missing case.
- Mocks are exposed, not summarized. A `get` returns the `jest.fn` itself (`get.saveMock()`), and the spec asserts with jest matchers: `expect(driver.get.saveMock()).toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(...)`. Never `get.saveCalls(): number => mock.calls.length` — a count getter rebuilds a matcher and hides the call arguments.
- Callback mocks passed as props are typed from the component, never retyped: `jest.fn<ComponentProps<typeof Foo>['onChange']>()`. Same for hooks: `jest.fn<ReturnType<typeof useFoo>['save']>()`. Retyping the signature drifts silently when the prop changes.
- A dependency mock is a bare `jest.fn<typeof fn>()` (or `jest.fn<ComponentProps<...>['prop']>()`) with no implementation. Its behavior comes from `given`s that queue values: `given.publishedArtifact(manifest)` → `mock.mockResolvedValueOnce(manifest)`, `given.deployment(manifest)` → `mock.mockResolvedValue(bytes)`, a pending call → `given.publishedArtifactLoad(promise)` → `mock.mockReturnValue(promise)`. Never a fake implementation inside the mock (a lookup map keyed by request, counters, branching): that is test logic hiding inside a boundary. A concurrency case keeps calls pending with a never-resolving promise and asserts `toHaveBeenCalledTimes(n)` after a `setTimeout(0)` flush, never a counter in the mock.
- A `given` parameter is typed from the source (`AtlasHostDeploymentManifest`). A case that must feed a non-conforming document widens with a concrete member, `AtlasHostDeploymentManifest | null`, and passes `null`; never `unknown`, and never `Type | unknown` (collapses to `unknown`). Prefer `null` over a hand-shaped invalid object (`{ ...manifest, kind: 'app' }`): the shape claims knowledge of which field the validator checks, which belongs to the validator's own spec.
- Driver members carry no return annotation: `catalog: () => this.catalog`, `runtime: (runtime: AtlasHostRuntimeConfig) => { ...; return this; }`, `loaded: async () => { ... }`. The type is inferred from the body; an annotation (`: AtlasHostCatalog | undefined`, `: FooDriver`, `: void`, `: Promise<void>`) only restates it and drifts when the field changes. Parameters stay typed.
- A unit that touches the DOM (`document.createElement`, `head.append`, `getElementById`) is driven under jsdom: the spec starts with `/** @jest-environment jsdom */`, the driver passes the real `document` and resets what the unit touches in its constructor (`document.head.replaceChildren()`, `document.body.replaceChildren(this.hostRoot)`), and `get`s read back from the DOM (`Array.from(document.head.querySelectorAll('link'), (link) => ({ rel: link.rel, href: link.getAttribute('href') }))`). Never hand-build element fakes (`{ tagName, append }` cast to `HTMLHeadElement`): the cast hides the shape mismatch and the fake drifts from the DOM the unit runs in. jsdom does not reflect every IDL attribute (`integrity` stays a plain property, `crossorigin` reflects); read the property the unit sets, or `getAttribute`, whichever the real browser and jsdom agree on.
- A unit reads only the dependencies it names. When a helper takes a cluster-wide dependency object but uses two members, declare `type FooDependencies = Pick<ClusterDependencies, 'a' | 'b'>` next to the unit and take that; the driver then passes `{ a, b }` with no cast. `as unknown as ClusterDependencies` on a partial object is a missing `Pick`, not a test shortcut.
- One cast is accepted, narrowly: a generic function (`fetchJson<T>`) cannot be a `jest.fn<typeof fetchJson>()` without `this.fetchJson as typeof fetchJson` at the call site (TypeScript cannot unify `Mock<generic>` with the generic). Keep it on that one property, never on the whole dependencies object.
- `when` names say what happens in domain terms, not which control was touched: `when.tabScopeSelected()`, `when.overrideEnabled()`; never `when.tabSelected()`, `when.radioClicked(1)`. Reads as a sentence in the `it` name: `should report tab scope when tab scope is selected`. The `when` names the trigger as the user performs it (`saveClicked`, `versionChosen`); a result verb (`saved`, `submitted`, `cleared`) is allowed only when the unit itself produces that result. A button bar that calls `onSave` has `when.saveClicked()`, never `when.saved()`: the `it` says `when save button is clicked`, and the `when` must read the same.
- The `it` name states the exact observation the `expect` makes, in the terms of the assertion. A callback case names the prop and its argument: `should call onChange with pr selection of chosen version key when the pr version is chosen`, `should call onSave once when save button is clicked`; never `should report ...` / `should notify ...` / `should emit ...`, which hide which prop fires and with what. A testkit case names the element and the state read: `should disable save button when save is disabled`, `should mark option of deployed version as deployed when opened`; never a subjectless `should be disabled when ...` or a vague `should reflect ...`. Actual values stay out of the name: `should show correct placeholder when rendered`, never `should show "Choose a version" placeholder`; the literal lives only in the `expect`. The exception is `it.each`: the case value is part of the name through `%s` (`when the selection type is %s`), so each generated case is told apart. The `when` clause names the trigger as the spec performs it (`when save button is clicked`, `when a custom url is entered`) or the pinned condition (`when disabled`, `when no production versions exist`). `it.each` names carry one `%s` per argument; a second `%s` for the same argument prints literally.
- Same assertion over varying inputs → `it.each(CONST_ARRAY)`, literal array declared next to the `describe` that uses it. No filtered/derived arrays.
- Fixtures are declared where they are used, never at file top: an object one `it` needs is a `const` inside that `it`; one shared by several `it` blocks is a `const` at the top of their common `describe`. A fixture visible to cases that do not need it is misleading setup.
- A fixture pins a field only when the unit **branches** on it or the case **contrasts** it (`channel: 'production'` where the badge appears only for production; `supportedHosts` on both sides of a supported/unsupported pair). Every pinned field is a claim that the case depends on that exact value.
- A value the unit only reads, forwards, or formats is not pinned: take a bare factory object and derive the expectation from its own fields in the spec. `const version = anAppManifest(); ... expect(mock).toHaveBeenCalledWith(\`${version.channel}:${version.version}:${version.buildId}\`)`proves the fields are used, and says nothing about which values they hold. Pinning`channel: 'production', version: '1.0.0', buildId: 'b1'`here is noise: it makes the reader hunt for which of the three the case is about. Same for a forwarded choice:`const [selected, other] = faker.helpers.shuffle(SCOPES)`beats`'all'`/`'tab'` literals.
- Deriving the expectation means a template or field access on the fixture, never a production helper (`versionKey(version)` in a spec is still forbidden: the spec must spell the shape the unit is supposed to produce).
- The converse of pinning holds too: an `expect` that carries a literal depends on a field the case pinned, never on a factory or driver default. Factory fields are random, so a case that forgets a pin fails intermittently; treat a flaky spec as a missing pin, never as a reason to fix the factory value.
- A literal is allowed in a fixture or `given` only when the unit itself holds that literal (a union member it branches on, a string it compares against, a fixed message). Every other value is generated: ids, hosts, urls, names, versions, and the "other" side of a contrast. `supportedHosts: ['other-host']` claims the unit knows `other-host`; `supportedHosts: [faker.string.uuid()]` claims only that it differs.
- When a case contrasts two fixtures on one field, generate the value the unit compares against, pin it on the matching side and through the `given`, and generate a different one for the other side: `const hostId = faker.string.uuid(); supported = anAppManifest({ supportedHosts: [hostId] }); unsupported = anAppManifest({ supportedHosts: [faker.string.uuid()] }); given.hostId(hostId)`. Both directions get an `it` (`should enable ... when supports`, `should disable ... when does not support`); a contrast with only the negative case leaves the positive path untested.
- Every input a case's `expect` depends on is set in that case or its `describe`, including booleans: a callback case that needs the control enabled says `given.disabled(false)`. A driver default is a filler the spec never reads; when a default matters to a case it becomes a `given`, and the `describe` is named after the condition (`when selection is available`), not after the action (`when rendered`).
- Driver defaults are faker-generated, including union fields (`faker.helpers.arrayElement<Scope>(['all', 'tab'])`); a fixed default (`hostId = 'host'`, `selectedScope = 'all'`) is a hidden pin.
- Group by shared setup (`given` and/or `when`) with nested `describe('when ...')` + `beforeEach`. Do not group by "topic".
- Order `it` and `describe` blocks by setup size, simplest first: count `given` calls, then `when` calls. Bare `when.rendered()` cases (and the `describe` whose `beforeEach` is only `rendered`) come first; single-`given` cases next; `given` + extra `when` cases last. Inside a `describe`, expect-only `it` blocks precede those with a further `when`. Same size → keep the order the reader meets the feature (render, then interaction).
- Specs: no `import { describe, it, expect } from '@jest/globals'` — globals are injected and typed. Drivers keep `import { jest } from '@jest/globals'`: the global `jest` type lacks `unstable_mockModule` and the one-generic `jest.fn<typeof fn>()`.
- No `afterEach(cleanup)`: RTL auto-cleanup runs between tests (verified: `document.body` is empty in the next `it`).
- No comments in specs, drivers, or source. Blank line before every `return`. No inferable type annotations: drop the return type of every driver member and the type of every field an initializer infers; keep one only to widen (`ArtifactVersion | undefined` over a factory that returns `AtlasAppManifest`).
- Relative imports: apps use no extension; `packages/*` use `.js` (emitted ESM needs it). Follow the package you are in.

## Hooks

Mock the hooks the unit consumes, not the providers. Never wrap in real `Provider`s (forces full context values). Never extract a pure helper just to test it.

Mock only boundaries: hooks and context (react-query, `useColumbusState`), I/O (`chrome.*`, storage, tabs, fetch), time and randomness. A pure function the unit calls (`hostStatusOf`, `hasOverrides`, a reducer, a constant) runs for real: the spec feeds fixtures that drive it and asserts the result it produces. Mocking pure code couples the spec to the import layout and lets a mock return a value the real function never would. Router hooks are boundaries too: `useNavigate`, `useLocation` and the `Navigate` element are mocked through `src/testkit/mocks/react-router-dom.ts` (a partial mock that spreads the real module), never wrapped in a `MemoryRouter`. A unit that calls `useNavigate` gets `private readonly navigate = jest.fn<ReturnType<typeof useNavigateMock>>()` in the driver, `useNavigateMock.mockReturnValue(this.navigate)` in `when.rendered`, `get.navigate()` returning the mock, and the spec asserts the literal route: `expect(driver.get.navigate()).toHaveBeenCalledWith('/artifact/edit', { state: { artifact } })`. A unit that renders `<Navigate>` exposes `get.navigateMock: () => NavigateMock` (cleared in the constructor) and the spec asserts its props: `toHaveBeenCalledWith({ to: '/', replace: true }, undefined)`. A unit that reads `useLocation` sets `useLocationMock.mockReturnValue(aLocation({ state }))` in `when.rendered`; `aLocation()` lives next to the mocks and fills every `Location` field with faker. A driver whose children call a router hook still imports the mock file and returns a bare `jest.fn()` from `useNavigateMock`. Only `App` (the unit that owns `Routes`) renders inside a real `MemoryRouter`. The mock file registers every router export it replaces in one `unstable_mockModule` call: two files mocking the same module would overwrite each other.

```ts
import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { useBar as useBarType } from '../bar/useBar';

const useBar = jest.fn<typeof useBarType>();
jest.unstable_mockModule('../bar/useBar', () => ({ useBar }));
const { useFoo } = await import('./useFoo');

useBar.mockReturnValue({ status } as ReturnType<typeof useBarType>);
renderHook(() => useFoo()).result.current;
```

A hook driver stores the render in `private hook!: RenderHookResult<ReturnType<typeof useFoo>, undefined>` (definite assignment, no `undefined` guard: `renderHook` runs in `when.rendered`, and a spec that reads before rendering fails on its own). The spec reads the hook's return through one `get`, `result: () => this.hook.result.current`; never a `HookResult` alias type, never a guard that throws `'Hook was not rendered.'`, never a second `get` (`configuration`, `value`) that forwards `result`. A spec asserts `driver.get.result()` (or a field of it), and the `it` name says `should return ...`.

A hook that two or more drivers mock gets one shared mock file in the package's `src/testkit/mocks/<hook>.ts` (columbus: `useHost`, `useColumbusState`, `useOverrides`, `useActionsDisabled`). The file exports `<hook>Mock = jest.fn<typeof <hook>Type>()` and registers the mock against the hook's own file, so a barrel (`state/index.ts`) re-exports the mock too. The driver imports the mock statically (`import { useHostMock } from '../../testkit/mocks/useHost'`) above its `await import('./Unit')` and sets it with `useHostMock.mockReturnValue(...)`. Import one mock file per hook, never a `mocks/index.ts` barrel: registration is an import side effect, and a barrel would mock the unit under test in a state-hook driver. The exception is a third-party module whose several exports are mocked (`react-router-dom.ts`): one file per module, because a second `unstable_mockModule` on the same module replaces the first. The mock path is absolute, `fileURLToPath(new URL('../../state/useHost/useHost', import.meta.url))`: Jest 29 binds `@jest/globals` to the first file that imports it, so a relative path inside the mock file resolves from the driver (jestjs/jest#15772, fixed in 30.1). A driver that mocks a module partially spreads the real one: `const hostTabs = await import('../host-tabs/host-tabs')` before `unstable_mockModule(..., () => ({ ...hostTabs, loadArtifactVersionFromHostTab }))`.

Dynamic `await import` is required: static imports load before `unstable_mockModule` runs. When the driver registers mocks and the spec calls the unit itself, the spec imports the driver statically and the unit dynamically below it (`import { HostDataDriver } from './host-data.driver'; const { readHostData } = await import('./host-data');`): the driver module evaluates first and registers the mocks, then the unit links against them. `jest.mock` and `jest.spyOn` do not work under ESM (`Cannot assign to read only property`). Do not switch a package to CJS: faker v10 and workspace `dist/` are ESM-only.

## Entry scripts (side effects at import)

A module that registers listeners or runs work at import (`background.ts`, content scripts) is tested through its entry, not by extracting helpers. The driver imports it lazily: every `when` first calls a private `start()` that does `await import('./script')` once; the constructor runs `jest.resetModules()` so each test gets fresh module state. Global listeners added at import (`window.addEventListener`) are recorded by patching `addEventListener` at driver-module top and removed in the constructor. Browser APIs (`chrome.*`, `fetch`, `matchMedia`, `setInterval`) come from testkits or `jest.fn` globals set in the constructor; the driver emits events (`emitRuntimeMessage`, `dispatchEvent`) and awaits a `setTimeout(0)` flush before `get`.

## Environment

- Default environment comes from the package's jest config. A suite that needs the other environment carries `/** @jest-environment jsdom */` or `/** @jest-environment node */` on line 1.
- Tests must run with `--experimental-vm-modules`. WebStorm: set it in the Jest run configuration "Node options". `TS1378` top-level await error = flag missing or IDE mapped the file to the wrong tsconfig (root `tsconfig.json` references `tsconfig.tests.json` for that).

## Self-check (run every time)

```bash
grep -c "^\s*it\(\.each\)\?(" foo.specs.ts   # number of test blocks
grep -c "expect(" foo.specs.ts               # must be EQUAL
grep "'should" foo.specs.ts | grep -v " when "   # must print nothing
grep -n "new .*Driver()" foo.specs.ts        # exactly one hit, inside beforeEach
grep -c "^\s*driver\.when\.\w*();$" foo.specs.ts   # bare `when` statement; 2+ hits with same name → describe + beforeEach
grep -n "afterEach(cleanup)\|//\|/\*" foo.specs.ts foo.driver.ts   # must print nothing
```

Mismatch → split the `it`, do not delete asserts.

Then the pin audit, by hand: for every field a fixture pins, point at the source line that branches on it. No line → drop the pin. Then read each `describe`/`it` name and check it mentions every pinned condition its cases share.

Then the coverage audit, by hand:

- List every callback prop (`onX`) and every hook/service call the unit makes. Each one has an `it` that triggers it and asserts on its mock. A `disabled` case for a button is not a click case.
- List every conditional in the source (`&&`, ternary, early `return`, `switch`). Each branch has an `it`.
- A driver `get`/`when` that no spec calls is a case you forgot, not dead code. If it is a helper, make it `private` and out of `get`.

## Rationalizations (all invalid)

| Excuse                                                  | Reality                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| "Wrap the call in `when`, the spec reads cleaner"       | The spec calls the unit. A driver arranges boundaries; it never invokes or stores the unit's result.      |
| "Two expects test the same thing"                       | Two expects = two behaviors. Split into two `it`.                                                         |
| "`should X` is clear enough"                            | Name must contain `when`. Gate is mechanical.                                                             |
| "`should report the chosen version` says what happens"  | Name the prop and argument: `should call onChange with ...`. `report`/`notify`/`emit` hide the assertion. |
| "Extract `isX()` so the hook is testable"               | Mock consumed hooks, `renderHook` the real hook.                                                          |
| "Wrap in real providers, it's more realistic"           | Forces full context values. Mock the hook.                                                                |
| "Copy the `it` three times, it's short"                 | `it.each`.                                                                                                |
| "`it.each` over all pairs proves every path"            | Only if paths exist. A forwarded value has one path; one case.                                            |
| "`(scope: Scope) => void` is the same type as the prop" | Type from `ComponentProps<typeof Foo>['onChange']`. One source of truth.                                  |
| "`get.saveCalls()` reads nicer than the mock"           | Return the mock; assert with `toHaveBeenCalledTimes` / `toHaveBeenCalledWith`.                            |
| "Each `it` calls `when.rendered()`, it's explicit"      | Shared setup → `describe` + `beforeEach`. Repeated setup hides which case is different.                   |
| "`when.rendered().when.opened()` reads as one flow"     | `when` returns `void`. Two actions = `rendered` in `beforeEach`, `opened` in the `it`.                    |
| "In a hurry, ship it"                                   | Rules are completion gates. Fast + wrong = not done.                                                      |

## Red flags — STOP

- `expect(` count ≠ test block count
- A driver member that calls the unit under test (`get.uniqueVersionKeys()`, `when.hostDataRead()`, a `try/catch` feeding `get.errorMessage()`); a driver for a unit with no boundary
- `new XDriver()` inside `it`
- Separate `driver.given...;` and `driver.when...;` statements in a render or entry-script spec (a spec that calls the unit itself has `given`s, a blank line, then the call inside the `expect`)
- Fixture line touching the setup statement, or an action separated from its sibling action by a blank line (segments are fixtures / setup / actions / expect, one blank line between, none within)
- A `when` returning `this` or chained after another `when` (`when.rendered().when.opened()`)
- Same `driver.when.rendered()` (or same `given...when` chain) repeated in sibling `it` blocks instead of a `describe` `beforeEach`
- `given.noX()` / parameterless `given.flag()` — intent-named givens
- Production helper imported into a spec to build the expected value
- `const X = '...'` in a spec whose value also appears in the driver
- A `when` that builds its own request or sender instead of using what the spec gave
- Callback mock typed by hand instead of `ComponentProps<...>['prop']`
- `when` named after a control (`tabSelected`, `buttonClicked`) instead of the domain action
- `when` named after a result the unit does not produce (`saved`, `cleared`) instead of the trigger (`saveClicked`)
- `get.xCalls()` returning `mock.calls.length` instead of the mock itself
- A mock with a fake implementation (`jest.fn(async ({ reference }) => this.artifacts.get(reference.path))`, a counter, a branch) instead of values queued by `given`s
- `unknown` (or `Type | unknown`) as a `given` parameter type; a hand-shaped invalid fixture (`{ ...manifest, kind: 'app' }`) where `null` proves the same branch
- A return annotation on a driver member (`(): void =>`, `(): FooDriver =>`, `(): Catalog | undefined =>`)
- An element fake (`{ tagName }`, `{ append }`) cast to a DOM type instead of jsdom and the real `document`
- `as unknown as XDependencies` on a partial dependencies object instead of a per-unit `Pick`
- A driver member wrapping one expression in a block (`async () => { await this.get.button().click(); }`) instead of an expression arrow (`() => this.get.button().click()`)
- A bare `when.rendered()` case below one that needs `given`s
- A `describe` `beforeEach` with a `given` that some case under it does not depend on (`clearDisabled(false)` above a save-click case)
- A callback prop or branch with no `it` (driver has `cancelButton()` but no `cancelClicked` case)
- Spec in `tests/` outside `e2e/`
- Fixture `const` at file top, or a fixture visible to a `describe` that does not use it
- A fixture pinning a field no `expect` in its scope depends on
- An `expect` literal whose value comes from a factory or driver default instead of a pinned field
- A fixture pinning `version`/`buildId`/`channel`-style values for a case that only checks they are forwarded or formatted (derive the expectation from the fixture instead)
- A contrast case where only one side pins the discriminating field, or a contrast whose "other" value is a literal (`'other-host'`) instead of a generated one
- A contrast with only the negative `it` (`should disable ... when unsupported`) and no positive twin
- A pin added after a test went red instead of after reading the source condition
- A `describe` name that omits a condition its fixtures pin (`channel: 'production'` under `when the deployed version ...`)
- A negative twin whose fixture differs from the positive one in more than the field under test
- A `describe('when rendered')` whose cases depend on a driver default (`disabled = false`) that no `given` sets
- A fixed literal as a driver default (`hostId = 'host'`, `selectedScope = 'all'`)
- A literal (`'Orders'`, `'Boom'`) where the case only needs _some_ value
- One sampled member of a union the unit branches on, instead of `it.each` over all members
- `it.each` over every member/transition of a value the unit only forwards
- Comment in any file you touched
- A `given`/`when`/`get` member with a `: this`, `: void`, `: Promise<void>` or other inferable return annotation; a one-expression member written as a block (`async () => { await x(); }`)
- `screen.getByRole` / `userEvent` on a WDS component instead of its testkit; a WDS element a driver touches with no `dataHook`
- A hook driver with an `undefined` guard around `hook.result.current`, a `HookResult` type alias, or a `get` (`configuration`) that only forwards `get.result()`
- A `get` that wraps a single testkit call (`isOptionDisabled`, `optionTextOf`, `placeholder`) instead of returning the testkit
- A parameterised testkit `get` named after an element (`card`, `prDropdown`) instead of the testkit (`radio`, `dropdown`); a bare testkit name (`input`) for a no-argument `get` in a multi-element driver; one that builds a `dataHook` from a domain value (`card(type)`); or a `dataHook` parameter on a `get` that only ever receives one value
- A faker-generated `dataHook` (driver default or spec fixture); data hooks are constants
- An `it` name that hides the assertion: `should report/notify/emit ...` for a callback, a subjectless `should be disabled when ...`, `should reflect ...` for a testkit read; a literal value (`"Deployed"`, `"Choose a version"`) typed inside an `it` name (an `it.each` `%s` is not a literal)
