import { faker } from '@faker-js/faker';
import type {
  AngularWorkspaceDocument,
  TsconfigDocument,
} from '../../shared/types/generated-documents.js';
import type {
  AngularStylesheetFormat,
  AtlasProjectType,
} from '../../shared/types/generator-types.js';
import type { AngularVersionProfile } from '../../shared/versions/generator-versions.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  angularAppTsconfig,
  angularFederationConfig,
  angularFederationConfigFile,
  angularRootTsconfig,
  angularWorkspace,
} from './angular-workspace-generator.js';

export class AngularWorkspaceGeneratorDriver {
  private name = anAtlasId();
  private type: AtlasProjectType = faker.helpers.arrayElement<AtlasProjectType>(
    ['host', 'app'],
  );
  private profile: AngularVersionProfile = anAngularVersionProfile();
  private devServerPort?: number;
  private stylesheetFormat?: AngularStylesheetFormat;
  private workspace!: AngularWorkspaceDocument;
  private tsconfig!: TsconfigDocument;
  private federationConfig!: string;
  private federationConfigFile!: string;

  readonly given = {
    name: (name: string): this => {
      this.name = name;

      return this;
    },
    type: (type: AtlasProjectType): this => {
      this.type = type;

      return this;
    },
    profile: (profile: AngularVersionProfile): this => {
      this.profile = profile;

      return this;
    },
    devServerPort: (devServerPort: number | undefined): this => {
      this.devServerPort = devServerPort;

      return this;
    },
    stylesheetFormat: (
      stylesheetFormat: AngularStylesheetFormat | undefined,
    ): this => {
      this.stylesheetFormat = stylesheetFormat;

      return this;
    },
  };

  readonly when = {
    workspaceGenerated: (): void => {
      this.workspace = angularWorkspace({
        name: this.name,
        type: this.type,
        profile: this.profile,
        devServerPort: this.devServerPort,
        stylesheetFormat: this.stylesheetFormat,
      });
    },
    rootTsconfigGenerated: (): void => {
      this.tsconfig = angularRootTsconfig();
    },
    appTsconfigGenerated: (): void => {
      this.tsconfig = angularAppTsconfig();
    },
    federationConfigGenerated: (): void => {
      this.federationConfig = angularFederationConfig({
        name: this.name,
        type: this.type,
        profile: this.profile,
      });
      this.federationConfigFile = angularFederationConfigFile(this.profile);
    },
  };

  readonly get = {
    project: () => this.workspace.projects[this.name]!,
    tsconfig: (): TsconfigDocument => this.tsconfig,
    federationConfig: (): string => this.federationConfig,
    federationConfigFile: (): string => this.federationConfigFile,
  };
}
