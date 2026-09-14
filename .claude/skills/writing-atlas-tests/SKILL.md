---
name: writing-atlas-tests
description: Use when adding, changing, or migrating any Jest unit test, spec, driver, or testkit in the atlas monorepo (packages/*, scripts/), including "add tests for X", "cover this function", or fixing a failing *.specs.ts
---

# Writing Atlas Tests

Rules live in `AGENTS.md` → "TypeScript tests". This skill is the procedure that satisfies them. Read that section first; it is the completion gate, this is the path.

**Violating the letter of the rules is violating the spirit of the rules.** "Faster to ship" is not an exception.

## Workflow

1. **Locate the unit.** One source file = one spec. Spec goes next to it: `foo.ts` → `foo.specs.ts` (+ `foo.driver.ts`). Never in a central `tests/` dir.
2. **Decide driver.** Skip the driver only if ALL hold: pure or plain I/O function, no mocks, no setup/teardown, **single** behavior case. Two or more `it` blocks → driver required.
3. **Write driver** (`*.driver.ts`): class with `given` (fixtures/mocks, `@faker-js/faker` for generated fields), `when` (actions), `get` (observed results). All arrangement lives here.
4. **Write spec** (`*.specs.ts`): `describe('<exported symbol>')`, each `it('should <result> when <condition>')`, body = fresh driver → `when` → **exactly one** `expect`. Cover primary success + failure/rejection branches.
5. **Run tests** from repo root (package `test` scripts cannot be narrowed to one file; extra patterns are OR-ed):
   ```bash
   node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.json --testPathPattern='packages/<pkg>/src/<file-stem>'
   ```
   Then run the whole package once: `pnpm --filter @atlas/<pkg> test`.
6. **Audit before done.** Run the self-check below.

## Self-check (run every time)

```bash
grep -c "^\s*it(" foo.specs.ts        # number of tests
grep -c "expect(" foo.specs.ts        # must be EQUAL to the number above
grep "it('should" foo.specs.ts | grep -v " when "   # must print nothing
```

Mismatch → split the `it`, do not delete asserts.

## Example (pure function, several cases → driver required)

```ts
// route-matcher.driver.ts
import { routeMatches } from './route-matcher.js';

export class RouteMatcherDriver {
  private route = { path: '/' } as Parameters<typeof routeMatches>[0];
  private result?: boolean;

  readonly given = {
    route: (path: string, match?: 'full' | 'prefix'): void => { this.route = { path, match }; },
  };
  readonly when = {
    matching: (pathname: string): void => { this.result = routeMatches(this.route, pathname); },
  };
  readonly get = {
    result: (): boolean | undefined => this.result,
  };
}
```

```ts
// route-matcher.specs.ts
import { describe, expect, it } from '@jest/globals';
import { RouteMatcherDriver } from './route-matcher.driver.js';

describe('routeMatches', () => {
  it('should match when pathname extends a prefix route', () => {
    const driver = new RouteMatcherDriver();
    driver.given.route('/checkout');

    driver.when.matching('/checkout/step/2');

    expect(driver.get.result()).toBe(true);
  });

  it('should not match when full route has extra segments', () => {
    const driver = new RouteMatcherDriver();
    driver.given.route('/checkout', 'full');

    driver.when.matching('/checkout/2');

    expect(driver.get.result()).toBe(false);
  });
});
```

## Rationalizations (all invalid)

| Excuse | Reality |
|---|---|
| "Pure function, driver is overkill" | Exception needs single case AND no setup. Multiple `it` → driver. |
| "Two expects test the same thing" | Two expects = two behaviors. Split into two `it`. |
| "`should X` is clear enough" | Name must contain ` when `. Gate is mechanical. |
| "In a hurry, ship it" | Rules are completion gates. Fast + wrong = not done. |
| "Documenting quirks is coverage" | Test primary logic branches. Incidental edge cases only if they affect primary logic. |

## Red flags — STOP

- `expect(` count ≠ `it(` count
- Spec in `tests/` outside `e2e/`
- `describe` nesting used to group cases instead of a driver
- Inline fixtures in spec body
