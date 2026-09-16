export interface PackageManifest {
  name: string;
  version: string;
  private: true;
  type?: 'module';
  atlas: { previews: unknown[] };
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface TsconfigDocument {
  extends?: string;
  compilerOptions: Record<string, unknown>;
  angularCompilerOptions?: Record<string, unknown>;
  files?: string[];
  include?: string[];
}

export interface AngularTarget {
  builder: string;
  options?: Record<string, unknown>;
  configurations?: Record<string, Record<string, unknown>>;
  defaultConfiguration?: string;
}

export interface AngularWorkspaceDocument {
  version: 1;
  projects: Record<
    string,
    {
      projectType: 'application';
      root: string;
      sourceRoot: string;
      architect: Record<string, AngularTarget>;
    }
  >;
}
