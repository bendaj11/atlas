export interface BootstrapFailure {
  message: string;
  suggestedActions: string[];
  code: string;
  cause: Error;
}

export type FatalErrorLogger = (
  message: string,
  failure: BootstrapFailure,
) => void;

export interface FatalErrorDependencies {
  readonly document: Pick<
    Document,
    'getElementById' | 'createElement' | 'body'
  >;
  readonly sessionStorage: Pick<Storage, 'removeItem'>;
  readonly localStorage: Pick<Storage, 'removeItem'>;
  readonly reloadPage: () => void;
  readonly logError: FatalErrorLogger;
}
