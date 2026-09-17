import { jest } from '@jest/globals';
import type { describeFatalError as describeFatalErrorType } from './describe-fatal-error/describe-fatal-error.js';
import type {
  BootstrapFailure,
  FatalErrorDependencies,
} from './fatal-error.types.js';

const describeFatalError = jest.fn<typeof describeFatalErrorType>();
jest.unstable_mockModule(
  './describe-fatal-error/describe-fatal-error.js',
  () => ({
    describeFatalError,
  }),
);
const { showFatalError } = await import('./fatal-error.js');

interface FakeElement {
  tagName: string;
  textContent: string;
  onclick: (() => void) | null;
  children: FakeElement[];
  attributes: Record<string, string>;
  append(...elements: FakeElement[]): void;
  replaceChildren(): void;
  setAttribute(name: string, value: string): void;
}

function aFakeElement(tagName: string): FakeElement {
  return {
    tagName,
    textContent: '',
    onclick: null,
    children: [],
    attributes: {},
    append(...elements) {
      this.children.push(...elements);
    },
    replaceChildren() {
      this.children = [];
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
}

export class FatalErrorDriver {
  private readonly body = aFakeElement('body');
  private readonly hostRoot = aFakeElement('div');
  private hostRootPresent = true;
  private readonly sessionStorage = { removeItem: jest.fn() };
  private readonly localStorage = { removeItem: jest.fn() };
  private readonly reloadPage = jest.fn();
  private readonly logError = jest.fn<FatalErrorDependencies['logError']>();

  constructor() {
    describeFatalError.mockReset();
  }

  readonly given = {
    failure: (failure: BootstrapFailure): FatalErrorDriver => {
      describeFatalError.mockReturnValue(failure);

      return this;
    },
    hostRootPresent: (present: boolean): FatalErrorDriver => {
      this.hostRootPresent = present;

      return this;
    },
  };

  readonly when = {
    shown: (error: unknown): void => {
      showFatalError({
        error,
        dependencies: {
          document: {
            body: this.body as unknown as HTMLElement,
            getElementById: () =>
              this.hostRootPresent
                ? (this.hostRoot as unknown as HTMLElement)
                : null,
            createElement: ((tagName: string) =>
              aFakeElement(tagName)) as Document['createElement'],
          },
          sessionStorage: this.sessionStorage,
          localStorage: this.localStorage,
          reloadPage: this.reloadPage,
          logError: this.logError,
        },
      });
    },
    overridesCleared: (): void => {
      this.panel()
        .children.find((element) => element.tagName === 'button')
        ?.onclick?.();
    },
  };

  readonly get = {
    hostRootChildCount: (): number => this.hostRoot.children.length,
    bodyChildCount: (): number => this.body.children.length,
    message: (): string | undefined => this.childText('p'),
    actionHeading: (): string | undefined => this.childText('strong'),
    actions: (): string[] =>
      this.panel()
        .children.find((element) => element.tagName === 'ol')
        ?.children.map((item) => item.textContent) ?? [],
    sessionStorageMock: () => this.sessionStorage.removeItem,
    localStorageMock: () => this.localStorage.removeItem,
    reloadPageMock: () => this.reloadPage,
    logErrorMock: () => this.logError,
    describeFatalErrorMock: () => describeFatalError,
  };

  private panel(): FakeElement {
    const root = this.hostRootPresent ? this.hostRoot : this.body;

    return root.children[0]!;
  }

  private childText(tagName: string): string | undefined {
    return this.panel().children.find((element) => element.tagName === tagName)
      ?.textContent;
  }
}
