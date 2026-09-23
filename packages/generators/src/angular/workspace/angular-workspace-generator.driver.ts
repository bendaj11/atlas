import { faker } from '@faker-js/faker';
import type {
  AngularWorkspaceDocument,
  TsconfigDocument,
} from '../../shared/types/generated-documents.js';
import type {
  AngularStylesheetFormat,
  AtlasProjectType,
} from '../../shared/types/generator-types.js';
import type { AngularVersionProfile } from '../../shared/versions/generator-versions.types.js';
import { anAtlasId } from '../../testkit/generator-options.testkit.js';
import { anAngularVersionProfile } from '../../testkit/version-profiles.testkit.js';
import {
  buildAngularAppTsconfig,
  renderAngularFederationConfig,
  selectAngularFederationConfigFileName,
  buildAngularRootTsconfig,
  buildAngularWorkspaceDocument,
} from './angular-workspace-generator.js';

export class AngularWorkspaceGeneratorDriver {
  private name = anAtlasId();
  private type: AtlasProjectType = faker.helpers.arrayElement<AtlasProjectType>(
    ['host', 'app'],
  );
  private profile = anAngularVersionProfile();
  private devServerPort?: number;
  private stylesheetFormat?: AngularStylesheetFormat;
  private workspace!: AngularWorkspaceDocument;
  private tsconfig!: TsconfigDocument;
  private federationConfig!: string;
  private federationConfigFile!: string;

  readonly given = {
    name: (name: string) => {
      this.name = name;

      return this;
    },
    type: (type: AtlasProjectType) => {
      this.type = type;

      return this;
    },
    profile: (profile: AngularVersionProfile) => {
      this.profile = profile;

      return this;
    },
    devServerPort: (devServerPort: number | undefined) => {
      this.devServerPort = devServerPort;

      return this;
    },
    stylesheetFormat: (
      stylesheetFormat: AngularStylesheetFormat | undefined,
    ) => {
      this.stylesheetFormat = stylesheetFormat;

      return this;
    },
  };

  readonly when = {
    workspaceGenerated: () => {
      this.workspace = buildAngularWorkspaceDocument({
        name: this.name,
        type: this.type,
        profile: this.profile,
        devServerPort: this.devServerPort,
        stylesheetFormat: this.stylesheetFormat,
      });
    },
    rootTsconfigGenerated: () => {
      this.tsconfig = buildAngularRootTsconfig();
    },
    appTsconfigGenerated: () => {
      this.tsconfig = buildAngularAppTsconfig();
    },
    federationConfigGenerated: () => {
      this.federationConfig = renderAngularFederationConfig({
        name: this.name,
        type: this.type,
        profile: this.profile,
      });
      this.federationConfigFile = selectAngularFederationConfigFileName(
        this.profile,
      );
    },
  };

  readonly get = {
    project: () => this.workspace.projects[this.name]!,
    tsconfig: () => this.tsconfig,
    federationConfig: () => this.federationConfig,
    federationConfigFile: () => this.federationConfigFile,
  };
}
