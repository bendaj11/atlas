import { initFederation } from "@atlas/sdk/federation";

void initFederation()
  .then(() => import("./bootstrap"))
  .then(({ bootstrap }) => bootstrap())
  .catch((error) => console.error("Atlas host failed to start", error));
