import { expect, it } from '@jest/globals';
import { publicationContentType } from './publication-metadata.js';

it.each([
  ['registry.json', 'application/json; charset=utf-8'],
  ['remoteEntry.json', 'application/json; charset=utf-8'],
  ['entry.js', 'text/javascript; charset=utf-8'],
  ['styles.css', 'text/css; charset=utf-8'],
  ['font.woff2', 'font/woff2'],
  ['asset.unknown', 'application/octet-stream'],
])(
  'should return expected content type when publication path is %s',
  (path, contentType) => {
    expect(publicationContentType(path)).toBe(contentType);
  },
);
