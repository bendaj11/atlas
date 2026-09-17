export const HOST_STATUSES = ['LOADING', 'ERROR', 'LOADED'] as const;
export type HostStatus = (typeof HOST_STATUSES)[number];
