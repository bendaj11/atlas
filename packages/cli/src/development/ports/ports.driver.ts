import { faker } from '@faker-js/faker';
import { CliArguments } from '../../cli/arguments.js';
import type { HostDevPorts } from '../types.js';
import { resolveHostDevPorts } from './ports.js';

type PortScenario =
  | 'default'
  | 'custom-browser'
  | 'explicit-bootstrap'
  | 'deployed'
  | 'conflict'
  | 'generated';

export class DevelopmentPortsDriver {
  private readonly projectName = faker.word.noun().toLowerCase();
  private readonly customPort = faker.number.int({ min: 4500, max: 4999 });
  private readonly bootstrapPort = faker.number.int({ min: 5000, max: 5499 });
  private readonly generatedPort = faker.number.int({ min: 5500, max: 5999 });
  private arguments?: CliArguments;
  private configuredPort = 4200;
  private ports?: HostDevPorts;

  given = {
    configuration: (scenario: PortScenario): void => {
      this.scenario = scenario;
      const arguments_ = ['dev', this.projectName];

      if (scenario === 'custom-browser') {
        arguments_.push(`--port=${this.customPort}`);
        this.configuredPort = this.customPort;
      }

      if (scenario === 'explicit-bootstrap') {
        arguments_.push(
          `--port=${this.customPort}`,
          `--bootstrap-port=${this.bootstrapPort}`,
        );
        this.configuredPort = this.customPort;
      }

      if (scenario === 'deployed') {
        arguments_.push(`--port=${this.customPort}`);
        this.configuredPort = this.customPort;
      }

      if (scenario === 'conflict') {
        arguments_.push(
          `--port=${this.customPort}`,
          `--host-client-port=${this.customPort}`,
        );
        this.configuredPort = this.customPort;
      }

      if (scenario === 'generated') this.configuredPort = this.generatedPort;

      this.arguments = new CliArguments(arguments_);
    },
  };

  when = {
    resolve: (): void => {
      if (!this.arguments) throw new Error('Port setup is required.');

      this.ports = resolveHostDevPorts({
        args: this.arguments,
        configuredPort: this.configuredPort,
        previewKind: this.scenario === 'deployed' ? 'deployed' : 'local',
      });
    },
  };

  private scenario: PortScenario = 'default';

  get = {
    bootstrapPort: (): number => this.bootstrapPort,
    customPort: (): number => this.customPort,
    generatedPort: (): number => this.generatedPort,
    ports: (): HostDevPorts | undefined => this.ports,
  };
}
