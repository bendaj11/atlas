import { DirectoryPublicationStorage } from "./directory-publication-storage.js";

export default {
  storage: () => new DirectoryPublicationStorage(process.env.ATLAS_E2E_STORAGE)
};
