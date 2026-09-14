---
name: writing-atlas-tests
description: Use when adding, changing, or migrating any Jest unit test, spec, driver, or testkit in the atlas monorepo (packages/*, apps/*, scripts/), including "add tests for X", "cover this function/hook/component", or fixing a failing *.specs.ts
---

# Writing Atlas Tests

Rules live in `AGENTS.md` → "TypeScript tests". This skill is the procedure that satisfies them. Read that section first; it is the completion gate, this is the path.

**Violating the letter of the rules is violating the spirit of the rules.** "Faster to ship" is not an exception.

## Workflow

1. **Locate the unit.** One source file = one spec. Spec goes next to it: `foo.ts` → `foo.specs.ts` (+ `foo.driver.ts`). Never in a central `tests/` dir.
2. **Decide driver.** Skip the driver only if ALL hold: pure or plain I/O function, no mocks, no setup/teardown, **single** behavior case. Two or more `it` blocks → driver required.
3. **Write driver** (`*.driver.ts`, `.tsx` if it renders JSX): class with `given` (fixtures/mocks, `@faker-js/faker` for generated fields), `when` (actions), `get` (observed results). Every `given`/`when` returns `this`. All arrangement lives here.
4. **Write spec** (`*.specs.ts`): shape below. Cover primary success + failure/rejection branches.
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
- `given` and `when` chained in **one** statement. Blank line, then the single `expect`.
- Same assertion over varying inputs → `it.each(CONST_ARRAY)`, literal arrays at file top. No filtered/derived arrays.
- Group by precondition with nested `describe('when ...')` + `beforeEach` applying that `given`. Do not group by "topic".
- No `afterEach(cleanup)`: RTL auto-cleanup runs (jest globals injected).
- No comments in specs, drivers, or source. Blank line before every `return`.

## Hooks

Mock the hooks the unit consumes, not the providers. Never wrap in real `Provider`s (forces full context values). Never extract a pure helper just to test it.

```ts
import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { useBar as useBarType } from '../bar/useBar.js';

const useBar = jest.fn<typeof useBarType>();
jest.unstable_mockModule('../bar/useBar.js', () => ({ useBar }));
const { useFoo } = await import('./useFoo.js');

useBar.mockReturnValue({ status } as ReturnType<typeof useBarType>);
renderHook(() => useFoo()).result.current;
```

Dynamic `await import` is required: static imports load before `unstable_mockModule` runs. `jest.mock` and `jest.spyOn` do not work under ESM (`Cannot assign to read only property`). Do not switch a package to CJS: faker v10 and workspace `dist/` are ESM-only.

## Environment

- Default environment comes from the package's jest config. A suite that needs the other environment carries `/** @jest-environment jsdom */` or `/** @jest-environment node */` on line 1.
- Tests must run with `--experimental-vm-modules`. WebStorm: set it in the Jest run configuration "Node options". `TS1378` top-level await error = flag missing or IDE mapped the file to the wrong tsconfig (root `tsconfig.json` references `tsconfig.tests.json` for that).

## Self-check (run every time)

```bash
grep -c "^\s*it\(\.each\)\?(" foo.specs.ts   # number of test blocks
grep -c "expect(" foo.specs.ts               # must be EQUAL
grep "'should" foo.specs.ts | grep -v " when "   # must print nothing
grep -n "new .*Driver()" foo.specs.ts        # exactly one hit, inside beforeEach
grep -n "afterEach(cleanup)\|//\|/\*" foo.specs.ts foo.driver.ts   # must print nothing
```

Mismatch → split the `it`, do not delete asserts.

## Rationalizations (all invalid)

| Excuse | Reality |
|---|---|
| "Pure function, driver is overkill" | Exception needs single case AND no setup. Multiple `it` → driver. |
| "Two expects test the same thing" | Two expects = two behaviors. Split into two `it`. |
| "`should X` is clear enough" | Name must contain ` when `. Gate is mechanical. |
| "Extract `isX()` so the hook is testable" | Mock consumed hooks, `renderHook` the real hook. |
| "Wrap in real providers, it's more realistic" | Forces full context values. Mock the hook. |
| "Copy the `it` three times, it's short" | `it.each`. |
| "In a hurry, ship it" | Rules are completion gates. Fast + wrong = not done. |

## Red flags — STOP

- `expect(` count ≠ test block count
- `new XDriver()` inside `it`
- Separate `driver.given...;` and `driver.when...;` statements
- Spec in `tests/` outside `e2e/`
- Inline fixtures in spec body
- Comment in any file you touched
