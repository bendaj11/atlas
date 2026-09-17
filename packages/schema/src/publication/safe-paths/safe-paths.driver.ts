import { assertSafeArtifactId, assertSafeRelativePath } from './safe-paths.js';

export class SafePathsDriver {
  when = {
    artifactIdAsserted: (value: unknown, subject?: string) => {
      assertSafeArtifactId(value, subject);
    },
    relativePathAsserted: (value: string, subject: string) => {
      assertSafeRelativePath(value, subject);
    },
  };
}
