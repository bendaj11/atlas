import { assertAtlasHostCatalog } from './assert-atlas-host-catalog.js';

export class AssertAtlasHostCatalogDriver {
  when = {
    asserted: (value: unknown) => {
      assertAtlasHostCatalog(value);
    },
  };
}
