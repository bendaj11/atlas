import { createMemoryNavigation } from "../../testkit/dist/index.js";
import { createAtlasSdk } from "../dist/host.js";

export function createHostSdk(options: Record<string, unknown> = {}) {
  return createAtlasSdk({ hostId: "host", navigation: createMemoryNavigation(), ...options });
}
