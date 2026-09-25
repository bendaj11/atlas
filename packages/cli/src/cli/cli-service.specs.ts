import { faker } from '@faker-js/faker';
import { aReport, CliServiceDriver } from './cli-service.driver.js';

describe('runAtlasCli', () => {
  let driver: CliServiceDriver;

  beforeEach(() => {
    driver = new CliServiceDriver();
  });

  it.each(['--version', '-v', 'version'])(
    'should print the package version when %s is the only argument',
    async (flag) => {
      await driver.when.run([flag]);

      expect(driver.get.infoOutput()).toMatch(/^\d+\.\d+\.\d+/);
    },
  );

  it('should print help without detecting a workspace when --help is given', async () => {
    await driver.when.run(['publish', '--help']);

    expect(driver.get.detectWorkspaceMock()).not.toHaveBeenCalled();
  });

  it('should reject as an unknown command when the command is not recognized', async () => {
    await expect(driver.when.run(['frobnicate'])).rejects.toMatchObject({
      summary: 'Unknown or incomplete command "frobnicate".',
    });
  });

  it('should wrap failures in a CLI error naming the command when a command throws', async () => {
    const message = faker.lorem.sentence();
    driver.get.devRunMock().mockRejectedValue(new Error(message));

    await expect(driver.when.run(['dev', 'orders'])).rejects.toMatchObject({
      summary: `Atlas dev failed: ${message}`,
      surface: 'cli',
    });
  });

  describe('workspace commands', () => {
    it('should load env files from the workspace root when a workspace command runs', async () => {
      await driver.when.run(['compile-config', 'orders']);

      expect(driver.get.loadEnvFilesMock()).toHaveBeenCalledWith(
        driver.get.workspace().root,
      );
    });

    it('should not load env files when dev runs', async () => {
      await driver.when.run(['dev', 'orders']);

      expect(driver.get.loadEnvFilesMock()).not.toHaveBeenCalled();
    });

    it('should compile the resolved project config when compile-config runs', async () => {
      await driver.when.run(['compile-config', 'orders']);

      expect(driver.get.compileAtlasConfigMock()).toHaveBeenCalledWith(
        driver.get.workspace(),
        driver.get.project(),
      );
    });

    it('should build the named host when bootstrap runs', async () => {
      await driver.when.run(['bootstrap', 'shell']);

      expect(driver.get.bootstrapBuildMock()).toHaveBeenCalledWith('shell');
    });

    it('should run development for the current directory when dev has no project', async () => {
      await driver.when.run(['dev']);

      expect(driver.get.devRunMock()).toHaveBeenCalledWith(
        '.',
        expect.anything(),
      );
    });

    it('should publish the named project when publish runs', async () => {
      await driver.when.run(['publish', 'orders']);

      expect(driver.get.publishRunMock()).toHaveBeenCalledWith(
        'orders',
        undefined,
      );
    });

    it('should list uploaded files when publish is a dry run', async () => {
      driver.get.publishRunMock().mockResolvedValue({
        uploaded: ['a', 'b'],
        dryRun: true,
        manifest: {
          path: 'a',
          digest: 'sha256:x',
          size: 1,
          mediaType: 'application/json',
        },
        registryRevision: 'sha256:r',
      });

      await driver.when.run(['publish', 'orders', '--dry-run']);

      expect(driver.get.infoOutput()).toMatch(
        /Dry run complete: 2 files would be written\. Storage was not changed\./,
      );
    });
  });

  describe('generate', () => {
    it('should print generate help when no name is given non-interactively', async () => {
      await driver.when.run(['generate', 'app']);

      expect(driver.get.generateProjectMock()).not.toHaveBeenCalled();
    });

    it.each(['host', 'app'])(
      'should generate a %s project when a name is given',
      async (type) => {
        await driver.when.run(['g', type, 'orders']);

        expect(driver.get.generateProjectMock()).toHaveBeenCalledWith(
          type,
          'orders',
          undefined,
          expect.any(Function),
        );
      },
    );

    it('should install dependencies after generation when --skip-install is absent', async () => {
      await driver.when.run(['generate', 'app', 'orders']);

      expect(driver.get.generateInstallMock()).toHaveBeenCalledWith([
        '/generated',
      ]);
    });

    it('should skip dependency installation when --skip-install is given', async () => {
      await driver.when.run(['generate', 'app', 'orders', '--skip-install']);

      expect(driver.get.generateInstallMock()).not.toHaveBeenCalled();
    });

    it('should generate a widget with the app id when generate widget runs', async () => {
      const appId = faker.string.uuid();

      await driver.when.run([
        'generate',
        'widget',
        'banner',
        `--app-id=${appId}`,
      ]);

      expect(driver.get.generateWidgetMock()).toHaveBeenCalledWith(
        'banner',
        appId,
      );
    });
  });

  describe('workspace-free commands', () => {
    it('should deploy without detecting a workspace when deploy runs', async () => {
      await driver.when.run([
        'deploy',
        'orders',
        '--to=production',
        '--version=1.0.0',
      ]);

      expect(driver.get.detectWorkspaceMock()).not.toHaveBeenCalled();
    });

    it('should verify configured host URLs after a deploy when the registry config lists them', async () => {
      const hostUrl = faker.internet.url();
      driver.given.registryConfig({ hostUrls: [hostUrl] });

      await driver.when.run([
        'deploy',
        'orders',
        '--to=production',
        '--version=1.0.0',
      ]);

      expect(driver.get.verifyRunMock()).toHaveBeenCalledWith({ hostUrl });
    });

    it('should remove the preview when remove-preview runs with --pr', async () => {
      driver.get
        .removePreviewMock()
        .mockResolvedValue({ removed: true, registryRevision: 'sha256:r' });

      await driver.when.run(['remove-preview', 'orders', '--pr=7']);

      expect(driver.get.removePreviewMock()).toHaveBeenCalledWith(
        'orders',
        7,
        undefined,
      );
    });

    it('should reject remove-preview when both --pr and --mr are given', async () => {
      await expect(
        driver.when.run(['remove-preview', 'orders', '--pr=7', '--mr=7']),
      ).rejects.toThrow(/Pass exactly one of --pr or --mr/);
    });

    it('should reject prune-previews when --state-file is missing', async () => {
      await expect(driver.when.run(['prune-previews'])).rejects.toThrow(
        /requires --state-file/,
      );
    });

    it('should prune previews from the state file when prune-previews runs', async () => {
      const states = [
        {
          kind: 'app' as const,
          id: faker.string.uuid(),
          openPreviews: new Set([1]),
        },
      ];
      driver.given.openPreviews(states);

      await driver.when.run(['prune-previews', '--state-file=state.json']);

      expect(driver.get.prunePreviewsMock()).toHaveBeenCalledWith(
        states,
        undefined,
      );
    });

    it('should reject verify when no host URL is configured', async () => {
      await expect(driver.when.run(['verify'])).rejects.toThrow(
        /--host-url or ATLAS_HOST_URLS is required/,
      );
    });

    it('should verify every listed host when verify runs with --host-urls', async () => {
      await driver.when.run([
        'verify',
        '--host-urls=https://a.example,https://b.example',
      ]);

      expect(driver.get.verifyRunMock().mock.calls).toStrictEqual([
        [{ hostUrl: 'https://a.example' }],
        [{ hostUrl: 'https://b.example' }],
      ]);
    });

    it('should reject verify when a report has failures', async () => {
      driver.given.verificationReport(
        aReport({
          failures: 1,
          checks: [{ status: 'failure', subject: 'x', message: 'bad' }],
        }),
      );

      await expect(
        driver.when.run(['verify', '--host-url=https://a.example']),
      ).rejects.toThrow(
        /verification failed for https:\/\/a.example with 1 failure/,
      );
    });
  });
});
