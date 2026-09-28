# Host Not-Found Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Host-owned not-found page in the route outlet when no App route matches the URL.

**Architecture:** The runtime controller publishes a `routeNotFound` flag through the anchor registry, the same way it publishes the active layout. `AtlasRouteOutlet` (React and Angular) renders an inner mount element that Atlas mounts Apps into, and next to it renders the Host's not-found component (or a default) while the flag is set.

**Tech Stack:** TypeScript, React 17–19, Angular 19–22, Jest (ESM, `--experimental-vm-modules`), jsdom, `@faker-js/faker`, `@atlas/testkit`.

**Spec:** `docs/superpowers/specs/2026-09-28-host-not-found-design.md`

## Global Constraints

- Follow the `writing-atlas-tests` skill for every spec and driver (`AGENTS.md` → "TypeScript tests").
- No code comments. Blank line before every `return`. No inferable type annotations. No `as` casts.
- Relative imports inside `packages/*` end in `.js`.
- Run a single spec while iterating: `node --experimental-vm-modules node_modules/jest/bin/jest.js --config packages/runtime/jest.config.mjs --testPathPattern=<path>`. Never pass `--maxWorkers`.
- Run `graphify update .` after code changes.
- Commit only when the user asks.
- Routing rules (`route-plan.ts`, `route-path.ts`) do not change.

---

### Task 1: Route-not-found flag in the anchor registry

**Files:**
- Modify: `packages/runtime/src/dom-host/host-anchors.ts`
- Modify: `packages/runtime/src/dom-host/host-anchors.driver.ts`
- Test: `packages/runtime/src/dom-host/host-anchors.specs.ts`

**Interfaces:**
- Produces on `AtlasHostAnchorRegistry`:
  - `setRouteNotFound(routeNotFound: boolean): void`
  - `isRouteNotFound(): boolean` (default `false`)
  - `subscribeRouteNotFound(listener: AtlasHostAnchorListener): UnsubscribeAnchorListener`

- [ ] **Step 1: Add driver members**

In `HostAnchorsDriver` add a listener mock, a `given`, a `when`, and two `get`s:

```ts
private readonly routeNotFoundListener = jest.fn<AtlasHostAnchorListener>();
```

```ts
routeNotFoundSubscribed: () => {
  this.registry.subscribeRouteNotFound(this.routeNotFoundListener);

  return this;
},
```

```ts
routeNotFoundSet: (routeNotFound: boolean) =>
  this.registry.setRouteNotFound(routeNotFound),
```

```ts
routeNotFound: () => this.registry.isRouteNotFound(),
routeNotFoundListenerMock: () => this.routeNotFoundListener,
```

- [ ] **Step 2: Write the failing specs**

Append to `host-anchors.specs.ts` inside `describe('AtlasHostAnchorRegistry')`:

```ts
  it('should report no route not found when the flag was never set', () => {
    expect(driver.get.routeNotFound()).toBe(false);
  });

  it('should report route not found when the flag is set', () => {
    driver.when.routeNotFoundSet(true);

    expect(driver.get.routeNotFound()).toBe(true);
  });

  it('should notify route not found subscribers when the flag changes', () => {
    driver.given.routeNotFoundSubscribed().when.routeNotFoundSet(true);

    expect(driver.get.routeNotFoundListenerMock()).toHaveBeenCalledTimes(1);
  });

  it('should not notify route not found subscribers when the same flag is set again', () => {
    driver.given.routeNotFoundSubscribed().when.routeNotFoundSet(true);

    driver.when.routeNotFoundSet(true);

    expect(driver.get.routeNotFoundListenerMock()).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 3: Run and verify failure**

Run: `node --experimental-vm-modules node_modules/jest/bin/jest.js --config packages/runtime/jest.config.mjs --testPathPattern=packages/runtime/src/dom-host/host-anchors`
Expected: FAIL, `setRouteNotFound is not a function`.

- [ ] **Step 4: Implement**

In `AtlasHostAnchorRegistry`, next to the layout members:

```ts
  private readonly routeNotFoundListeners = new Set<AtlasHostAnchorListener>();
  private routeNotFound = false;
```

```ts
  setRouteNotFound(routeNotFound: boolean): void {
    if (this.routeNotFound === routeNotFound) return;

    this.routeNotFound = routeNotFound;

    for (const listener of this.routeNotFoundListeners) listener();
  }

  isRouteNotFound(): boolean {
    return this.routeNotFound;
  }

  subscribeRouteNotFound(
    listener: AtlasHostAnchorListener,
  ): UnsubscribeAnchorListener {
    this.routeNotFoundListeners.add(listener);

    return () => this.routeNotFoundListeners.delete(listener);
  }
```

- [ ] **Step 5: Run and verify pass**

Same command. Expected: PASS.

---

### Task 2: Runtime publishes the flag

**Files:**
- Modify: `packages/runtime/src/host-runtime/host-runtime.types.ts`
- Modify: `packages/runtime/src/host-runtime/runtime-controller.ts:98-112`
- Modify: `packages/runtime/src/dom-host/dom-host-runtime.ts:148`
- Modify: `packages/runtime/src/host-runtime/host-runtime.driver.ts`
- Modify: `packages/runtime/src/dom-host/dom-host-runtime.driver.ts`
- Test: `packages/runtime/src/host-runtime/host-runtime.specs.ts`
- Test: `packages/runtime/src/dom-host/dom-host-runtime.specs.ts`

**Interfaces:**
- Consumes: `AtlasHostAnchorRegistry.setRouteNotFound`, `isRouteNotFound` (Task 1).
- Produces: `AtlasHostRuntimeOptions.setRouteNotFound?: PublishRouteNotFound`, with `export type PublishRouteNotFound = (routeNotFound: boolean) => void;`.

- [ ] **Step 1: Add driver members**

`host-runtime.driver.ts`:

```ts
private readonly setRouteNotFound = jest.fn<PublishRouteNotFound>();
```

Pass `setRouteNotFound: this.setRouteNotFound` in `when.started`, and add `setRouteNotFoundMock: () => this.setRouteNotFound` to `get`.

`dom-host-runtime.driver.ts`: add `routeNotFound: () => this.anchors.isRouteNotFound()` to `get`.

- [ ] **Step 2: Write the failing specs**

`host-runtime.specs.ts`, inside `describe('startAtlasHostRuntime')`:

```ts
  describe('when a production app declares a route for the host', () => {
    beforeEach(async () => {
      driver.given.manifests([
        anAppManifest({
          channel: 'production',
          placements: [
            aRoutePlacement({
              hostId: driver.hostId,
              route: { path: '/orders' },
            }),
          ],
        }),
      ]);
      await driver.when.started();
    });

    it('should publish route not found when navigated to a path no route matches', async () => {
      await driver.when.navigatedTo(`/${faker.word.noun()}-${faker.string.alphanumeric(6)}`);

      expect(driver.get.setRouteNotFoundMock()).toHaveBeenLastCalledWith(true);
    });

    it('should clear route not found when navigated to the route path', async () => {
      await driver.when.navigatedTo('/orders');

      expect(driver.get.setRouteNotFoundMock()).toHaveBeenLastCalledWith(false);
    });
  });
```

`dom-host-runtime.specs.ts`, inside `describe('when the catalog selects a production app with a visible route')`:

```ts
    it('should mark the route as not found when started on a path no route matches', async () => {
      await driver.when.started();

      expect(driver.get.routeNotFound()).toBe(true);
    });

    it('should clear the not found route when navigation moves to the route path', async () => {
      await driver.when.started();

      await driver.when.navigatedTo('/orders');

      expect(driver.get.routeNotFound()).toBe(false);
    });
```

The memory navigation starts at `/`, which the `/orders` route does not match.

- [ ] **Step 3: Run and verify failure**

Run both specs with `--testPathPattern='packages/runtime/src/(host-runtime/host-runtime|dom-host/dom-host-runtime)'`.
Expected: FAIL (mock not called, flag stays `false`).

- [ ] **Step 4: Implement**

`host-runtime.types.ts`:

```ts
export type PublishRouteNotFound = (routeNotFound: boolean) => void;
```

and in `AtlasHostRuntimeOptions`, after `setActiveLayout`:

```ts
  setRouteNotFound?: PublishRouteNotFound;
```

`runtime-controller.ts`, in `reconcileRoute` directly after the `publishActiveLayout(...)` call:

```ts
    this.options.setRouteNotFound?.(!selected);
```

`dom-host-runtime.ts`, next to `setActiveLayout`:

```ts
    setRouteNotFound: (routeNotFound) => anchors.setRouteNotFound(routeNotFound),
```

- [ ] **Step 5: Run and verify pass**

Same command. Expected: PASS.

---

### Task 3: React route outlet renders the not-found page

**Files:**
- Modify: `packages/runtime/src/react.ts` (`AtlasRouteOutlet`, `AtlasHostProvider`, `AtlasReactHostApplication`, new `AtlasDefaultNotFound`)
- Modify: `packages/runtime/src/react.types.ts` (`ReactHostDefinition`, `AtlasHostProviderProps`)
- Modify: `packages/runtime/src/react.driver.tsx`
- Test: `packages/runtime/src/react.specs.tsx`

**Interfaces:**
- Consumes: `setRouteNotFound`, `isRouteNotFound`, `subscribeRouteNotFound` (Task 1).
- Produces:
  - `ReactHostDefinition.notFound?: ComponentType`
  - `AtlasHostProviderProps.notFound?: ComponentType`
  - `AtlasRouteOutlet` renders `<atlas-route-outlet>` containing `<div style="display: contents">` (registered as the `route-outlet` anchor) followed by the not-found component while the flag is set.
  - Exported `AtlasDefaultNotFound` component: `<section data-atlas-not-found><h1>Page not found</h1><a href="/">Go to the home page</a></section>`. The link click calls `preventDefault()` and `getAtlasNavigation(useAtlasSdk()).navigate('/')`.

- [ ] **Step 1: Extend the driver**

In `react.driver.tsx`:

```ts
function HostNotFound() {
  return createElement('p', { 'data-testid': 'host-not-found' });
}
```

Fields and members:

```ts
private notFound = faker.datatype.boolean();
private readonly routerNavigate = jest.fn<RouterLike['navigate']>();
```

Replace the inline `navigate: () => undefined` in `host()` with `navigate: this.routerNavigate`, and pass `...(this.notFound ? { notFound: HostNotFound } : {})` to `AtlasHostProvider`. Import `RouterLike` from `@atlas/sdk/react`; if the named-type rule forbids the indexed access, declare `type RouterNavigate = RouterLike['navigate'];` at the top of the driver.

```ts
notFound: (notFound: boolean) => {
  this.notFound = notFound;

  return this;
},
```

```ts
routeNotFoundSet: (routeNotFound: boolean) =>
  act(async () => {
    this.anchors().setRouteNotFound(routeNotFound);
  }),
defaultNotFoundLinkClicked: () =>
  act(async () => {
    document
      .querySelector<HTMLAnchorElement>('[data-atlas-not-found] a')!
      .click();
  }),
```

```ts
routeOutletParentTag: () =>
  this.anchors().get('route-outlet')?.parentElement?.tagName,
hostNotFoundPresent: () =>
  document.querySelector('[data-testid="host-not-found"]') !== null,
defaultNotFoundPresent: () =>
  document.querySelector('[data-atlas-not-found]') !== null,
routerNavigateMock: () => this.routerNavigate,
```

- [ ] **Step 2: Write the failing specs**

In `react.specs.tsx`, inside `describe('when the layout is activated')`:
- Change `it.each(['navigation', 'route-outlet'] as const)` to `it.each(['navigation'] as const)`.
- Add:

```ts
      it('should register the mount element inside atlas-route-outlet as the route-outlet anchor when activated', () => {
        expect(driver.get.routeOutletParentTag()).toBe('ATLAS-ROUTE-OUTLET');
      });

      it('should render no not-found page when no route-not-found flag is set', () => {
        expect(driver.get.defaultNotFoundPresent()).toBe(false);
      });
```

Add a sibling `describe` that pins `notFound`:

```ts
  describe('when a host with a not-found component activates its layout', () => {
    beforeEach(async () => {
      await driver.given.notFound(true).when.hostRendered();

      await driver.when.layoutActivated();
    });

    it('should render the host not-found component when the route is not found', async () => {
      await driver.when.routeNotFoundSet(true);

      expect(driver.get.hostNotFoundPresent()).toBe(true);
    });

    it('should remove the host not-found component when the route is found again', async () => {
      await driver.when.routeNotFoundSet(true);
      await driver.when.routeNotFoundSet(false);

      expect(driver.get.hostNotFoundPresent()).toBe(false);
    });
  });

  describe('when a host without a not-found component activates its layout and the route is not found', () => {
    beforeEach(async () => {
      await driver.given.notFound(false).when.hostRendered();

      await driver.when.layoutActivated();
      await driver.when.routeNotFoundSet(true);
    });

    it('should render the default not-found page when the route is not found', () => {
      expect(driver.get.defaultNotFoundPresent()).toBe(true);
    });

    it('should navigate the router to the root path when the default not-found link is clicked', async () => {
      await driver.when.defaultNotFoundLinkClicked();

      expect(driver.get.routerNavigateMock()).toHaveBeenCalledWith('/', expect.anything());
    });
  });
```

Check `createHostNavigation` in `@atlas/sdk/react` for the exact arguments it passes to `router.navigate`, and assert those literals instead of `expect.anything()`.

Add a `defineReactHost` case next to the existing `reactHostMounted` cases. For it, `DefinedHostLayout` in the driver renders `createElement(AtlasRouteOutlet)` inside its `main`, and `reactHostMounted` passes `...(this.notFound ? { notFound: HostNotFound } : {})` to `defineReactHost`:

```ts
  it('should render the definition not-found component when the mounted host route is not found', async () => {
    await driver.given.notFound(true).when.reactHostMounted();

    await driver.when.routeNotFoundSet(true);

    expect(driver.get.hostNotFoundPresent()).toBe(true);
  });
```

`routeNotFoundSet` reads the registry through `startedOptions().anchors`, which both `hostRendered` and `reactHostMounted` produce, so the same `when` serves both.

- [ ] **Step 3: Run and verify failure**

Run: `--testPathPattern=packages/runtime/src/react`
Expected: FAIL on the new cases.

- [ ] **Step 4: Implement**

`react.types.ts`: import `ComponentType` (already imported) and add `notFound?: ComponentType;` to both `ReactHostDefinition` and `AtlasHostProviderProps`.

`react.ts`:

```ts
const AtlasNotFoundContext = createContext<ComponentType>(AtlasDefaultNotFound);
```

`AtlasHostProvider` wraps its children:

```ts
  return createElement(AtlasHostAnchorsContext.Provider, {
    value: anchors,
    children: createElement(AtlasNotFoundContext.Provider, {
      value: props.notFound ?? AtlasDefaultNotFound,
      children: createElement(AtlasSdkProvider, {
        sdk,
        children: props.children,
      }),
    }),
  });
```

`AtlasReactHostApplication` passes `...(definition.notFound ? { notFound: definition.notFound } : {})` to `AtlasHostProvider`.

`AtlasRouteOutlet`:

```ts
export function AtlasRouteOutlet(): ReactElement {
  const anchors = useAtlasHostAnchors();
  const NotFound = useContext(AtlasNotFoundContext);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const routeNotFound = useSyncExternalStore(
    (listener) => anchors.subscribeRouteNotFound(listener),
    () => anchors.isRouteNotFound(),
    () => false,
  );

  useEffect(
    () => (element ? anchors.register('route-outlet', element) : undefined),
    [anchors, element],
  );

  return createElement(
    'atlas-route-outlet',
    null,
    createElement('div', { ref: setElement, style: { display: 'contents' } }),
    routeNotFound ? createElement(NotFound) : null,
  );
}
```

`AtlasDefaultNotFound`:

```ts
export function AtlasDefaultNotFound(): ReactElement {
  const sdk = useAtlasSdk();

  return createElement(
    'section',
    { 'data-atlas-not-found': '' },
    createElement('h1', null, 'Page not found'),
    createElement(
      'a',
      {
        href: '/',
        onClick: (event: MouseEvent) => {
          event.preventDefault();
          getAtlasNavigation(sdk).navigate('/');
        },
      },
      'Go to the home page',
    ),
  );
}
```

Import `useAtlasSdk` from `@atlas/sdk/react`, `getAtlasNavigation` from `@atlas/sdk`, and `ComponentType` and `MouseEvent` types from `react`. Export `AtlasDefaultNotFound` from `packages/runtime/src/react.ts` public exports.

- [ ] **Step 5: Run and verify pass**

Same command. Expected: PASS.

---

### Task 4: Angular route outlet renders the not-found page

**Files:**
- Modify: `packages/runtime/src/adapters/angular-anchors.ts` (`AtlasRouteOutlet`, new `ATLAS_NOT_FOUND_COMPONENT`, new `AtlasDefaultNotFound`)
- Modify: `packages/runtime/src/angular.ts` (`defineAngularHost`, exports)
- Modify: `packages/runtime/src/angular.types.ts` (`AngularHostDefinition`)
- Modify: `packages/runtime/src/adapters/angular-anchors.driver.ts`
- Test: `packages/runtime/src/adapters/angular-anchors.specs.ts`
- Test: `packages/runtime/src/angular.specs.ts` and `packages/runtime/src/angular.driver.ts`

**Interfaces:**
- Consumes: `setRouteNotFound`, `isRouteNotFound`, `subscribeRouteNotFound` (Task 1).
- Produces:
  - `ATLAS_NOT_FOUND_COMPONENT = new InjectionToken<Type<unknown>>('ATLAS_NOT_FOUND_COMPONENT')`
  - `AngularHostDefinition.notFoundComponent?: Type<unknown>`
  - `AtlasRouteOutlet` template: `<div #mount style="display: contents"></div>` followed by the not-found component while the flag is set. The inner `div` is registered as the `route-outlet` anchor.
  - `AtlasDefaultNotFound`: `<section data-atlas-not-found><h1>Page not found</h1><a routerLink="/">Go to the home page</a></section>`

- [ ] **Step 1: Extend the driver**

In `angular-anchors.driver.ts`:

```ts
@Component({
  selector: 'atlas-test-not-found',
  standalone: true,
  template: '<p data-testid="host-not-found"></p>',
})
class HostNotFound {}
```

```ts
private notFoundComponent = faker.datatype.boolean();
```

```ts
readonly given = {
  notFoundComponent: (notFoundComponent: boolean) => {
    this.notFoundComponent = notFoundComponent;

    return this;
  },
};
```

In `when.bootstrapped` add `provideRouter([])` and, when `this.notFoundComponent`, `{ provide: ATLAS_NOT_FOUND_COMPONENT, useValue: HostNotFound }` to the providers.

```ts
routeNotFoundSet: (routeNotFound: boolean) => {
  this.anchors!.setRouteNotFound(routeNotFound);
  this.app!.tick();
},
```

```ts
routeOutletParentTag: () =>
  this.anchors!.get('route-outlet')?.parentElement?.tagName,
hostNotFoundPresent: () =>
  this.root.querySelector('[data-testid="host-not-found"]') !== null,
defaultNotFoundPresent: () =>
  this.root.querySelector('[data-atlas-not-found]') !== null,
```

- [ ] **Step 2: Write the failing specs**

In `angular-anchors.specs.ts`, inside `describe('when the layout is activated')`:
- Change the anchor `it.each` to `['navigation'] as const`.
- Add:

```ts
      it('should register the mount element inside atlas-route-outlet as the route-outlet anchor when activated', () => {
        expect(driver.get.routeOutletParentTag()).toBe('ATLAS-ROUTE-OUTLET');
      });
```

Add sibling `describe`s at the top level:

```ts
  describe('when a host with a not-found component activates its layout', () => {
    beforeEach(async () => {
      await driver.given.notFoundComponent(true).when.bootstrapped();

      driver.when.layoutActivated();
    });

    it('should render the host not-found component when the route is not found', () => {
      driver.when.routeNotFoundSet(true);

      expect(driver.get.hostNotFoundPresent()).toBe(true);
    });

    it('should remove the host not-found component when the route is found again', () => {
      driver.when.routeNotFoundSet(true);
      driver.when.routeNotFoundSet(false);

      expect(driver.get.hostNotFoundPresent()).toBe(false);
    });
  });

  describe('when a host without a not-found component activates its layout', () => {
    beforeEach(async () => {
      await driver.given.notFoundComponent(false).when.bootstrapped();

      driver.when.layoutActivated();
    });

    it('should render the default not-found page when the route is not found', () => {
      driver.when.routeNotFoundSet(true);

      expect(driver.get.defaultNotFoundPresent()).toBe(true);
    });
  });
```

In `angular.specs.ts`, add a `defineAngularHost` case that mounts with `notFoundComponent` and asserts the app injector resolves `ATLAS_NOT_FOUND_COMPONENT` to it. Add `given.notFoundComponent(component)` to `angular.driver.ts` and a `get.notFoundComponent: () => this.app!.injector.get(ATLAS_NOT_FOUND_COMPONENT, null)`:

```ts
  it('should provide the definition not-found component when mounted', async () => {
    await driver.given.notFoundComponent(HostNotFound).when.angularHostMounted();

    expect(driver.get.notFoundComponent()).toBe(HostNotFound);
  });
```

Use the existing `when` name that mounts through `defineAngularHost` in `angular.driver.ts`, and declare `HostNotFound` in that driver as in the anchors driver.

- [ ] **Step 3: Run and verify failure**

Run: `--testPathPattern='packages/runtime/src/(adapters/angular-anchors|angular)'`
Expected: FAIL on the new cases.

- [ ] **Step 4: Implement**

`angular-anchors.ts`:

```ts
export const ATLAS_NOT_FOUND_COMPONENT = new InjectionToken<Type<unknown>>(
  'ATLAS_NOT_FOUND_COMPONENT',
);

@Component({
  selector: 'atlas-default-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section data-atlas-not-found>
      <h1>Page not found</h1>
      <a routerLink="/">Go to the home page</a>
    </section>
  `,
})
export class AtlasDefaultNotFound {}
```

Give `AtlasAnchorComponent` an overridable element hook, used by `ngOnInit`:

```ts
  protected anchorElement(): HTMLElement {
    return this.element.nativeElement;
  }
```

```ts
      this.anchorElement(),
```

Replace `AtlasRouteOutlet`:

```ts
@Component({
  selector: 'atlas-route-outlet',
  standalone: true,
  imports: [NgComponentOutlet],
  template: `
    <div #mount style="display: contents"></div>
    @if (routeNotFound()) {
      <ng-container *ngComponentOutlet="notFoundComponent" />
    }
  `,
})
export class AtlasRouteOutlet extends AtlasAnchorComponent {
  protected readonly kind = 'route-outlet' as const;
  protected readonly notFoundComponent =
    inject(ATLAS_NOT_FOUND_COMPONENT, { optional: true }) ??
    AtlasDefaultNotFound;
  protected readonly routeNotFound = signal(this.anchors.isRouteNotFound());
  @ViewChild('mount', { static: true })
  private readonly mount!: ElementRef<HTMLElement>;
  private unsubscribeRouteNotFound: (() => void) | undefined;

  override ngOnInit(): void {
    super.ngOnInit();

    this.unsubscribeRouteNotFound = this.anchors.subscribeRouteNotFound(() =>
      this.routeNotFound.set(this.anchors.isRouteNotFound()),
    );
  }

  override ngOnDestroy(): void {
    this.unsubscribeRouteNotFound?.();

    super.ngOnDestroy();
  }

  protected override anchorElement(): HTMLElement {
    return this.mount.nativeElement;
  }
}
```

`subscribeRouteNotFound` returns a `boolean` from `Set.delete`; if TypeScript rejects the assignment to `() => void`, type the field with `UnsubscribeAnchorListener`.

`angular.types.ts`: add `notFoundComponent?: Type<unknown>;` to `AngularHostDefinition`.

`angular.ts`, in `defineAngularHost`, add to `appConfig.providers`:

```ts
          ...(definition.notFoundComponent
            ? [
                {
                  provide: ATLAS_NOT_FOUND_COMPONENT,
                  useValue: definition.notFoundComponent,
                },
              ]
            : []),
```

Export `ATLAS_NOT_FOUND_COMPONENT` and `AtlasDefaultNotFound` from `angular.ts`.

- [ ] **Step 5: Run and verify pass**

Same command. Expected: PASS.

---

### Task 5: Documentation and full verification

**Files:**
- Modify: `docs/concepts/routing.md`
- Modify: `docs/concepts/host-anchors.md`
- Modify: `docs/guides/react/routing.md`
- Modify: `docs/guides/angular/routing.md`
- Modify: `docs/reference/api.md`

- [ ] **Step 1: `docs/concepts/routing.md`**

After "How Atlas picks the App for a URL", add:

~~~md
## Unmatched URLs

When no route matches the URL, the route outlet shows the Host's not-found page. The URL does not change. Set the page with `notFound` in `defineReactHost` or `notFoundComponent` in `defineAngularHost`. Without one, Atlas shows a default "Page not found" page with a link to `/`.

To send `/` to a default App and show the not-found page for every other unknown URL, declare the redirect with `match: 'full'`:

```ts
{ hostId, path: '/', match: 'full', redirectTo: '/orders' }
```

An App route at `/` with the default `prefix` match matches every URL, so the not-found page never shows.

An unmatched URL activates the `default` layout. A Host whose `default` layout has no `AtlasRouteOutlet` shows no not-found page.

The server still returns `200` with `index.html` for the URL. The not-found page is client-side.
~~~

- [ ] **Step 2: `docs/concepts/host-anchors.md`**

In the route outlet section, state that Apps mount into an inner element of `atlas-route-outlet` and that the not-found page renders next to it, so CSS on `atlas-route-outlet` styles both.

- [ ] **Step 3: React and Angular routing guides**

Add a "Not-found page" section with the `defineReactHost({ ..., notFound: NotFoundPage })` and `defineAngularHost({ ..., notFoundComponent: NotFoundComponent })` examples. Note that the component renders inside the Host router, so `Link` and `routerLink` work.

- [ ] **Step 4: `docs/reference/api.md`**

Add `AtlasDefaultNotFound` to the React and Angular runtime export lists, and `ATLAS_NOT_FOUND_COMPONENT` to the Angular list.

- [ ] **Step 5: Full verification**

```bash
pnpm --filter @atlas/runtime test
```

Expected: PASS, coverage thresholds met.

```bash
pnpm --filter @atlas/runtime typecheck
```

If the package has no `typecheck` script, run its `build` script instead. Expected: no errors.

```bash
graphify update .
```

- [ ] **Step 6: Ask the user before committing**
