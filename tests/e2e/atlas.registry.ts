import { DirectoryPublicationStorage } from './directory-publication-storage.js';

export default {
  storage: () => new DirectoryPublicationStorage(process.env.ATLAS_E2E_STORAGE),
  resolvePreviewHead: async (preview: { gitSha: string }) => ({
    state: 'open' as const,
    headSha: preview.gitSha,
  }),
  verifyRegistry: async () => undefined,
};
