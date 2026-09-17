import { parseQuery, type QueryValues } from './parse-query.js';

export class ParseQueryDriver {
  private result: QueryValues | undefined;

  readonly when = {
    queryParsed: (search: string): void => {
      this.result = parseQuery(search);
    },
  };

  readonly get = {
    result: (): QueryValues | undefined => this.result,
  };
}
