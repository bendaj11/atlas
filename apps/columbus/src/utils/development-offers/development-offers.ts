import { isDevelopmentOfferIds } from '@atlas/schema';
import type { DevelopmentOffers } from '../../types/host-data';
import { rememberedControlPort } from '../control-port/control-port';
import {
  isRecord,
  loadDevelopmentSessionRequest,
} from '../messages/messages';
import { isStoredOverrideDocument } from '../override-document/override-document';

export async function readDevelopmentOffers(
  hostId: string,
): Promise<DevelopmentOffers | undefined> {
  const controlPort = rememberedControlPort();

  try {
    const response: unknown = await chrome.runtime.sendMessage(
      loadDevelopmentSessionRequest({
        hostId,
        previewUrl: location.href,
        ...(controlPort === undefined ? {} : { controlPort }),
      }),
    );
    const session = isRecord(response) ? response.document : undefined;

    if (!isStoredOverrideDocument(session) || session.hostId !== hostId)
      return undefined;

    const offerIds = 'offerIds' in session ? session.offerIds : undefined;

    return {
      overrides: session.overrides,
      ...(session.hostOverride ? { hostOverride: session.hostOverride } : {}),
      offerIds: isDevelopmentOfferIds(offerIds) ? offerIds : {},
    };
  } catch {
    return undefined;
  }
}
