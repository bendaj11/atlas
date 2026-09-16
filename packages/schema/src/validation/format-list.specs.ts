import { formatList } from './format-list.js';

describe('formatList', () => {
  it.each([
    [[], ''],
    [['a'], 'a'],
    [['a', 'b'], 'a or b'],
    [['a', 'b', 'c'], 'a, b, or c'],
  ])('should format %j as "%s" when listed', (values, expected) => {
    expect(formatList(values)).toBe(expected);
  });
});
