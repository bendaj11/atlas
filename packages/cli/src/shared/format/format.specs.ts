import { formatBytes, formatDuration, pluralize } from './format.js';

describe('format', () => {
  describe('formatBytes', () => {
    it.each([
      [0, '0 B'],
      [512, '512 B'],
      [1536, '1.5 KB'],
      [4_404_019, '4.2 MB'],
      [3 * 1024 ** 3, '3.0 GB'],
    ])('should format %d bytes as %s', (bytes, expected) => {
      expect(formatBytes(bytes)).toBe(expected);
    });
  });

  describe('formatDuration', () => {
    it.each([
      [250, '250ms'],
      [3140, '3.1s'],
      [65_000, '1m 5s'],
    ])('should format %d milliseconds as %s', (milliseconds, expected) => {
      expect(formatDuration(milliseconds)).toBe(expected);
    });
  });

  describe('pluralize', () => {
    it.each([
      [1, '1 file'],
      [68, '68 files'],
    ])('should describe %d files as %s', (count, expected) => {
      expect(pluralize(count, 'file')).toBe(expected);
    });
  });
});
