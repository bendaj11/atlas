import type { AtlasQueryValues } from '../navigation-types/navigation-types.js';
import { parseQuery } from './parse-query.js';

export class ParseQueryDriver {
  private result: AtlasQueryValues | undefined;

  readonly when = {
    queryParsed: (search: string) => {
      this.result = parseQuery(search);
    },
  };

  readonly get = {
    result: () => this.result,
  };
}
