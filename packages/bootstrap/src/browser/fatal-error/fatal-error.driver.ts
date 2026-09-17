import { jest } from '@jest/globals';
import { HOST_ROOT_ELEMENT_ID } from '../atlas-loader/atlas-loader.constants.js';
import type { describeFatalError as describeFatalErrorType } from './describe-fatal-error/describe-fatal-error.js';
import type {
  BootstrapFailure,
  FatalErrorLogger,
} from './fatal-error.types.js';

const describeFatalError = jest.fn<typeof describeFatalErrorType>();
jest.unstable_mockModule(
  './describe-fatal-error/describe-fatal-error.js',
  () => ({
    describeFatalError,
  }),
);
const { showFatalError } = await import('./fatal-error.js');

export class FatalErrorDriver {
  private readonly hostRoot = document.createElement('div');
  private readonly sessionStorage = { removeItem: jest.fn() };
  private readonly localStorage = { removeItem: jest.fn() };
  private readonly reloadPage = jest.fn();
  private readonly logError = jest.fn<FatalErrorLogger>();

  constructor() {
    describeFatalError.mockReset();

    this.hostRoot.id = HOST_ROOT_ELEMENT_ID;

    document.body.replaceChildren(this.hostRoot);
  }

  readonly given = {
    failure: (failure: BootstrapFailure) => {
      describeFatalError.mockReturnValue(failure);

      return this;
    },
    hostRootPresent: (present: boolean) => {
      if (!present) this.hostRoot.remove();

      return this;
    },
  };

  readonly when = {
    shown: (error: unknown) => {
      showFatalError({
        error,
        dependencies: {
          document,
          sessionStorage: this.sessionStorage,
          localStorage: this.localStorage,
          reloadPage: this.reloadPage,
          logError: this.logError,
        },
      });
    },
    overridesCleared: () => {
      document.querySelector('button')?.click();
    },
  };

  readonly get = {
    hostRootChildCount: () => this.hostRoot.childNodes.length,
    bodyChildCount: () => document.body.childNodes.length,
    message: () => document.querySelector('p')?.textContent,
    actionHeading: () => document.querySelector('strong')?.textContent,
    actions: () =>
      Array.from(document.querySelectorAll('li'), (item) => item.textContent),
    sessionStorageMock: () => this.sessionStorage.removeItem,
    localStorageMock: () => this.localStorage.removeItem,
    reloadPageMock: () => this.reloadPage,
    logErrorMock: () => this.logError,
    describeFatalErrorMock: () => describeFatalError,
  };
}
