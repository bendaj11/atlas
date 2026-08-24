import { describe, expect, it } from '@jest/globals';
import { CliArguments } from '../../cli/arguments.js';
import { readHostBindingRequest } from './host-binding.js';

describe('host binding request', () => {
  it('should normalize deployment bindings when host flags are provided', () => {
    const args = new CliArguments([
      'deploy',
      'customer-host',
      '--host-url',
      'https://customer.example.com/portal/, https://customer.example.com/portal',
      '--external-registries',
      'https://partners.example.com/atlas/|production',
    ]);

    expect(readHostBindingRequest(args, 'host')).toStrictEqual({
      baseUrls: ['https://customer.example.com/portal'],
      externalRegistries: [
        {
          registryUrl: 'https://partners.example.com/atlas',
          environment: 'production',
        },
      ],
    });
  });

  it('should reject host URL when an app is deployed', () => {
    const args = new CliArguments([
      'deploy',
      'customer-app',
      '--host-url',
      'https://customer.example.com',
    ]);

    expect(() => readHostBindingRequest(args, 'app')).toThrow(
      /can only be used when deploying a host/,
    );
  });
});
