import type { UserConfig } from 'vite';

export interface ReactViteConfigOptions {
  readonly projectRoot: string;
  readonly projectName: string;
  readonly reactMajor: number;
}

export interface ReactHostViteConfigOptions {
  readonly projectRoot: string;
  readonly projectName: string;
}

export interface ReactWidgetEntry {
  readonly name: string;
  readonly entryPoint: string;
}

export function createReactAppViteConfig(
  options: ReactViteConfigOptions,
): UserConfig;
export function createReactHostViteConfig(
  options: ReactHostViteConfigOptions,
): UserConfig;
export function createReactWidgetEntries(
  options: Pick<ReactViteConfigOptions, 'projectRoot' | 'reactMajor'>,
): ReactWidgetEntry[];
