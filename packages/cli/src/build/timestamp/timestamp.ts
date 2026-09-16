export function buildTimestamp(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const explicit = environment.ATLAS_CREATED_AT;
  if (explicit) {
    const timestamp = new Date(explicit);
    if (Number.isNaN(timestamp.valueOf()))
      throw new Error(
        `ATLAS_CREATED_AT must be an ISO-8601 timestamp, received "${explicit}".`,
      );

    return timestamp.toISOString();
  }
  const sourceDateEpoch = environment.SOURCE_DATE_EPOCH;
  if (!sourceDateEpoch) return new Date().toISOString();
  const seconds = Number(sourceDateEpoch);
  if (!Number.isInteger(seconds) || seconds < 0)
    throw new Error(
      `SOURCE_DATE_EPOCH must be a non-negative integer, received "${sourceDateEpoch}".`,
    );

  return new Date(seconds * 1000).toISOString();
}
