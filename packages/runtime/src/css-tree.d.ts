declare module 'css-tree/parser' {
  import type { parse } from 'css-tree';

  const parseCss: typeof parse;
  export default parseCss;
}

declare module 'css-tree/walker' {
  import type { walk } from 'css-tree';

  const walkCss: typeof walk;
  export default walkCss;
}

declare module 'css-tree/generator' {
  import type { generate } from 'css-tree';

  const generateCss: typeof generate;
  export default generateCss;
}

declare module 'css-tree/utils' {
  export { List } from 'css-tree';
}
