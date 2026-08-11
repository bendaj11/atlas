import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { faker } from '@faker-js/faker';
import { CliArguments } from '../../cli/arguments.js';
import { createTestWorkspace } from '../../test-utils/build.testkit.js';
import type {
  AtlasProject,
  AtlasWorkspace,
} from '../../workspace/service/workspace.js';
import { AtlasBuildService } from './build.service.js';

type BuildScenario =
  | 'source-maps'
  | 'pull-request'
  | 'angular-artifact'
  | 'missing-registry'
  | 'deterministic'
  | 'local-host-styles';

export class BuildServiceDriver {
  private readonly appId = faker.string.uuid();
  private readonly projectName = faker.word.noun().toLowerCase();
  private readonly gitSha = faker.git.commitSha();
  private readonly prNumber = faker.number.int({ min: 1, max: 999 });
  private readonly version = faker.system.semver();
  private scenario?: BuildScenario;
  private root = '';
  private artifactRoot = '';
  private project?: AtlasProject;
  private workspace?: AtlasWorkspace;
  private observation?: unknown;

  given = {
    build: async (scenario: BuildScenario): Promise<void> => {
      this.scenario = scenario;
      this.root = await mkdtemp(join(tmpdir(), 'atlas-build-service-'));
      const projectRoot = join(this.root, this.projectName);
      this.artifactRoot =
        scenario === 'angular-artifact'
          ? join(projectRoot, 'dist', this.projectName, 'browser')
          : join(projectRoot, 'dist');

      await mkdir(this.artifactRoot, { recursive: true });
      await writeFile(
        join(this.root, 'package.json'),
        JSON.stringify({ type: 'module' }),
      );
      await writeFile(
        join(projectRoot, 'atlas.config.js'),
        this.configSource(scenario),
      );
      await writeFile(join(this.artifactRoot, 'remoteEntry.json'), '{}\n');

      if (scenario === 'source-maps') {
        await writeFile(
          join(this.artifactRoot, 'remoteEntry.js.map'),
          faker.lorem.sentence(),
        );
      }

      this.project = {
        id:
          scenario === 'angular-artifact'
            ? `@example/${this.projectName}`
            : this.projectName,
        outputPaths: scenario === 'angular-artifact' ? [] : [this.artifactRoot],
        packageName: this.projectName,
        root: projectRoot,
        version: this.version,
      };
      this.workspace = createTestWorkspace({
        findProject: async () => this.project!,
        kind: scenario === 'angular-artifact' ? 'workspace' : 'standalone',
        root: this.root,
      });
    },
  };

  when = {
    buildManifest: async (): Promise<void> => {
      if (!this.workspace || !this.project || !this.scenario) {
        throw new Error('Build setup is required.');
      }

      if (this.scenario === 'source-maps') await this.buildSourceMaps();
      if (this.scenario === 'pull-request') await this.buildPullRequest();
      if (this.scenario === 'angular-artifact')
        await this.buildAngularArtifact();
      if (this.scenario === 'missing-registry')
        await this.buildMissingRegistry();
      if (this.scenario === 'deterministic')
        await this.buildDeterministically();
      if (this.scenario === 'local-host-styles')
        await this.buildLocalHostStyles();
    },
  };

  get = {
    observation: <T>(): T => this.observation as T,
  };

  private configSource(scenario: BuildScenario): string {
    const isAngular =
      scenario === 'angular-artifact' || scenario === 'local-host-styles';
    const hostType = scenario === 'local-host-styles' ? ', type: "host"' : '';
    const framework = isAngular ? 'angular' : 'react';

    return `export default { id: "${this.appId}", name: "${faker.company.name()}", framework: "${framework}"${hostType} };\n`;
  }

  private service(arguments_: string[]): AtlasBuildService {
    return new AtlasBuildService(this.workspace!, new CliArguments(arguments_));
  }

  private async buildSourceMaps(): Promise<void> {
    const arguments_ = [
      'build',
      this.projectName,
      '--skip-compile',
      '--channel=local',
    ];
    const first = await this.service(arguments_).buildManifest(
      this.projectName,
    );

    await writeFile(
      join(this.artifactRoot, 'remoteEntry.js.map'),
      faker.lorem.paragraphs(),
    );

    const second = await this.service(arguments_).buildManifest(
      this.projectName,
    );
    const included = await this.service([
      ...arguments_,
      '--include-source-maps',
    ]).buildManifest(this.projectName);

    this.observation = {
      excludedMapIsStable: first.buildId === second.buildId,
      includedMapChangesBuild: second.buildId !== included.buildId,
    };
  }

  private async buildPullRequest(): Promise<void> {
    const previousPr = process.env.CI_MERGE_REQUEST_IID;
    const previousSha = process.env.CI_COMMIT_SHA;
    process.env.CI_MERGE_REQUEST_IID = String(this.prNumber);
    process.env.CI_COMMIT_SHA = this.gitSha;

    try {
      const manifest = await this.service([
        'build',
        this.projectName,
        '--skip-compile',
        `--registry-base-url=${faker.internet.url()}`,
      ]).buildManifest(this.projectName, undefined, { skipCompile: true });

      this.observation = {
        channel: manifest.channel,
        gitShaMatches: manifest.gitSha === this.gitSha,
        prNumberMatches: manifest.prNumber === this.prNumber,
        versionMatches:
          manifest.version === `${this.version}-pr.${this.prNumber}`,
      };
    } finally {
      this.restoreEnvironment('CI_MERGE_REQUEST_IID', previousPr);
      this.restoreEnvironment('CI_COMMIT_SHA', previousSha);
    }
  }

  private async buildAngularArtifact(): Promise<void> {
    const manifest = await this.service([
      'build',
      this.projectName,
      '--skip-compile',
    ]).buildManifest(this.projectName, 'production', {
      baseUrl: faker.internet.url(),
      skipCompile: true,
    });

    this.observation = manifest.remoteEntryUrl.includes(`/apps/${this.appId}/`);
  }

  private async buildMissingRegistry(): Promise<void> {
    const previous = process.env.ATLAS_REGISTRY_URL;
    delete process.env.ATLAS_REGISTRY_URL;

    try {
      await this.service([
        'build',
        this.projectName,
        '--skip-compile',
      ]).buildManifest(this.projectName, 'production', { skipCompile: true });
    } finally {
      this.restoreEnvironment('ATLAS_REGISTRY_URL', previous);
    }
  }

  private async buildDeterministically(): Promise<void> {
    const previous = process.env.ATLAS_CREATED_AT;
    process.env.ATLAS_CREATED_AT = faker.date.past().toISOString();
    const arguments_ = [
      'build',
      this.projectName,
      '--skip-compile',
      `--registry-base-url=${faker.internet.url()}`,
    ];

    try {
      const first = await this.service(arguments_).buildManifest(
        this.projectName,
      );
      const second = await this.service(arguments_).buildManifest(
        this.projectName,
      );

      this.observation = JSON.stringify(first) === JSON.stringify(second);
    } finally {
      this.restoreEnvironment('ATLAS_CREATED_AT', previous);
    }
  }

  private async buildLocalHostStyles(): Promise<void> {
    const manifest = await this.service([
      'build',
      this.projectName,
    ]).buildLocalHostManifest(this.projectName, faker.internet.url());

    this.observation = manifest.styles?.[0]?.href.endsWith('/styles.css');
  }

  private restoreEnvironment(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
