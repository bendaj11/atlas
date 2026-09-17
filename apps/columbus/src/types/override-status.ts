export const OVERRIDE_STATUSES = ['IDLE', 'APPLYING', 'ERROR'] as const;
export type OverrideStatus = (typeof OVERRIDE_STATUSES)[number];
