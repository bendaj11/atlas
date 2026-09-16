import { assertSafeArtifactId, assertSafeRelativePath } from './safe-paths.js';

export class SafePathsDriver {
  when = {
    artifactIdAsserted: (value: unknown, subject?: string): void => {
      assertSafeArtifactId(value, subject);
    },
    relativePathAsserted: (value: string, subject: string): void => {
      assertSafeRelativePath(value, subject);
    },
  };
}
