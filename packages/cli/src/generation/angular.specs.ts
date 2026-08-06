import { describe, expect, it } from '@jest/globals';
import { ensureAngularNativeFederationTargets } from './angular.js';

describe('ensureAngularNativeFederationTargets', () => {
  it('should configure an SSE endpoint when an Angular host serves locally', () => {
    const targets: Record<string, unknown> = {
      build: { builder: '@angular-devkit/build-angular:application' },
      serve: { builder: '@angular-devkit/build-angular:dev-server' },
    };

    ensureAngularNativeFederationTargets(targets, 'catalog', 'host', 'builder');

    expect(targets.serve).toMatchObject({
      options: {
        buildNotifications: {
          enable: true,
          endpoint:
            '/@angular-architects/native-federation:build-notifications',
        },
      },
    });
  });
});
