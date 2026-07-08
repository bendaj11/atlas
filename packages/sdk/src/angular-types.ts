export interface RouterLike {
  readonly url: string;
  navigateByUrl(url: string, options?: { replaceUrl?: boolean; state?: unknown }): Promise<boolean>;
  events: { subscribe(listener: () => void): { unsubscribe(): void } };
}

export interface LocationLike {
  back(): void;
  historyGo?(delta: number): void;
}

export interface LocationStrategyAdapter {
  path(includeHash?: boolean): string;
  prepareExternalUrl(internal: string): string;
  getState(): unknown;
  pushState(state: unknown, title: string, url: string, queryParams: string): void;
  replaceState(state: unknown, title: string, url: string, queryParams: string): void;
  forward(): void;
  back(): void;
  historyGo(relativePosition: number): void;
  onPopState(listener: (event: { type: "popstate"; state: unknown }) => void): void;
  getBaseHref(): string;
  ngOnDestroy(): void;
}
