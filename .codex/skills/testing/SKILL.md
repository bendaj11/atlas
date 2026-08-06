---
name: testing
description: Apply whenever creating, editing, reviewing, refactoring, or planning any TypeScript unit test or end-to-end test. Enforce Jest, React or Angular Testing Library, test organization, mocks, asynchronous sad paths, driver-based tests, and crucial user workflows.
---

# Testing

Apply this skill every time a test file is created or edited. Do not bypass these rules for a small, existing, or legacy test.

## File placement

- Keep `index` units at their parent level. Put every other unit in a concise responsibility directory; when the parent already provides context, use the non-redundant terminal responsibility (`bootstrap/service/bootstrap.service.ts`, not `bootstrap/bootstrap.service/bootstrap.service.ts`). Put spec and local driver beside source.
- Placement is a hard precondition: before creating or editing a non-index spec, verify that source, spec, and driver are colocated in the responsibility directory. Move source first when they are not.
- Name TypeScript specs `*.specs.ts`; name React component specs `*.specs.tsx`.
- When a unit spec uses a local driver, give source, spec, and driver the same basename: `example.ts`, `example.specs.ts`, `example.driver.ts`.
- Split assertions across source modules. Do not test another module through generated output or source-text matching when its behavior can be tested directly.

```text
example/
  index.ts
  index.specs.ts
  index.driver.ts
  validation/
    validation.ts
    validation.specs.ts
    validation.driver.ts
```

- Put E2E specs only under an `e2e/` directory. Do not put unit specs in `tests/` or any central test directory.
- Treat every unit spec in a central `tests/` directory as misplaced. Move it beside source before editing it; do not add, copy, or retain unit specs there. Exceptions require an explicit user decision and a documented reason in the spec.

## Tools and queries

- Use Jest for TypeScript tests.
- Use React Testing Library for React client tests and Angular Testing Library for Angular client tests.
- Query client UI as users do: accessible role and name first, then label, text, or placeholder.
- Use `userEvent` for user interaction.
- Do not query CSS classes, DOM nesting, component instances, private state, or private methods.

## Test cases and suites

- Keep code airy. Add one blank line between logical segments such as fixture setup, mock configuration, action, observation, and assertion. Apply the same separation inside drivers and production functions. Do not insert blank lines inside one expression or split tightly related statements.

- A `describe` is a suite; an `it` is one test case.
- Each `it` proves one behavior and contains exactly one `expect`.
- Name each `it`: `should <expected result> when <given setup>`.

```ts
it('should show info icon when user is not logged in', () => {
  expect(driver.get.infoIcon()).toBeVisible();
});
```

- Split multiple observable outcomes into separate `it` cases.
- Group cases in a `describe` only when they share meaningful setup or teardown.
- Use `beforeEach` and `afterEach` to share that lifecycle and to reset state, mocks, and resources.
- Give every test fresh state. Never depend on test order or leftovers from another test.

## Unit-test scope

- Test behavior owned by one source file.
- Mock non-trivial imported functionality; test that functionality in its own spec.
- Use `jest.mock('<moduleName>')` for module mocks. Never use `jest.unstable_mockModule`.
- When native ESM prevents `jest.mock` from intercepting static imports, refactor the unit to accept injected dependencies and pass ordinary `jest.fn()` mocks through the driver.
- Mock network, storage, time, randomness, routing, analytics, and external services.
- Do not make real HTTP calls or turn a unit test into an integration test.
- Test main logic and meaningful branches: success, failure, empty or missing input, permissions, and important boundaries.
- Test user-visible content, accessible state, and interactions. Do not test incidental CSS, positioning, markup structure, or internal implementation mechanics.
- Avoid snapshots by default. Use a direct behavioral assertion; use a snapshot only for a stable serialized contract where it is clearer.

## Driver pattern

Create a local driver for every TypeScript test by default. Skip it only for a genuinely simple pure function or simple I/O function whose test has no mocks, no meaningful setup or teardown, and remains clearer as direct input/output assertions. If a test has mocks, async orchestration, state, cleanup, repeated setup, or more than one behavior case, use a driver.

Do not treat short test length as grounds to skip a driver. Driver removes test-boundary details from specs and keeps behavior readable.

Keep drivers small. Mock controllable boundaries, including filesystem, network, clock, and imported services, instead of creating temporary projects or real external state. Use real I/O only when that I/O is behavior owned by the unit and cannot be expressed through a focused mock.

Driver requirements:

- Driver setup must stay narrow: one fixture factory, minimal mock reset, and only state required by observed behavior.
- Use `@faker-js/faker` for generated mock field values. Fixed literals allowed only when they define branch behavior, protocol names, or serialized contract fields.
- Keep specs declarative. Specs must not construct fixtures, configure mocks, inspect mock call arrays, or derive output paths.
- Keep module-local mocks and one small Faker fixture initializer in the driver. Do not create a `*.testkit.ts` for one spec.
- Create a `*.testkit.ts` only when at least two colocated specs or drivers reuse the same non-trivial test doubles. The reuse must already exist; anticipated reuse does not qualify.

- Keep test cases declarative: arrange with `given`, act with `when`, observe with `get`.
- Let driver own rendering, interaction, and semantic queries.
- Let driver own mocks, spies, browser globals, storage, and reset logic. Specs must not call `jest.spyOn`, mutate globals, or restore driver-owned state.
- Keep mocks minimal: provide only members production code calls, using `jest.fn()` and plain objects. Do not create testkit classes for simple browser stubs.
- Generate mocked field values with `@faker-js/faker`, using the module that matches each field's meaning; pick literal-union values with `faker.helpers.arrayElement`. Keep fixed only values that define the behavior under test.
- For repeated custom Faker values, add a typed `faker.custom` generator and use it instead of repeating `arrayElement` choices.
- Prefer assigning a fresh plain global mock in `given` over `jest.spyOn` and `jest.restoreAllMocks()` when the original global is not needed.
- Do not use `jest.resetModules()` for fresh test state. Keep ESM mocks shared, then reset only their behavior in `given`.
- Use TypeScript `private` members in drivers; do not use ECMAScript `#` private fields.
- Keep driver-only mocks and fixture setup private in the driver file. Extract them only when the testkit reuse rule above is satisfied.
- Define driver operations only under `given`, `when`, or `get`. Expose reusable observed state through `get`, not private helper methods.
- Expose behavior, not implementation:
  - `given`: inputs, props, dependency responses, initial state. Never put setup in `when`.
  - `when`: render, click, type, submit, resolve, reject.
  - `get`: visible content, accessible controls, observable calls, emitted values.
- Keep driver assertions out of driver methods; assertions belong in `it` cases.
- Make every `given` accept explicit setup data. A zero-argument `given` is exceptional and requires there to be no setup value.
- Do not add a dummy `given(undefined)`; omit `given` when a test needs no setup.
- Create a fresh driver per test.
- In `beforeEach`, only create a fresh driver. Do not add an `afterEach` solely to restore driver-owned state; the next driver must reset it.
- Keep driver local to its spec unless several colocated specs genuinely reuse it.

```ts
describe('account warning', () => {
  let driver: AccountWarningDriver;

  beforeEach(() => {
    driver = new AccountWarningDriver();
  });

  it('should show info icon when user is not logged in', () => {
    driver.given.loggedOut().when.render();

    expect(driver.get.infoIcon()).toBeVisible();
  });
});
```

## Async and sad paths

- Mock direct async dependencies with type-correct `mockResolvedValue`, `mockRejectedValue`, or mock implementations.
- Spy on or mock direct dependencies; do not intercept an imported module's internal network request in a unit test.
- Await user interactions and visible async results with Testing Library `findBy*` or `waitFor`.
- Never use arbitrary sleeps, `setTimeout`, `setImmediate`, or event-loop workarounds.
- Cover meaningful sad paths: rejected request, missing input, unavailable data, denied permission, and an action that must not happen.
- Assert negative behavior directly when it matters.

```ts
it('should not report login when user name differs', () => {
  driver.given.name('Ada').when.render();

  expect(driver.get.reportLoginSpy()).not.toHaveBeenCalled();
});
```

## E2E tests

- Follow same suite grouping, `it` naming, one-behavior, one-`expect`, setup, and teardown rules.
- Cover main user actions, crucial workflows, and high-risk cross-system processes; do not reproduce every unit-test variation.
- Use stable user-visible locators and deterministic readiness checks. Never use fixed sleeps.
- Create isolated test data and clean it up after each test or suite.
- Keep tests independent, deterministic, safe to rerun, and focused on observable user outcomes.

## Before finishing

- Confirm spec placement and naming.
- Confirm every `it` has one behavior, one `expect`, and required description pattern.
- Confirm unit tests mock non-trivial imports and external boundaries.
- Confirm no single-spec `*.testkit.ts` was created.
- Confirm client tests use Testing Library semantic queries.
- Confirm async tests await observable outcomes.
- Confirm E2E tests cover only crucial workflows.
