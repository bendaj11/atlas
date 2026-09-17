import { jest } from '@jest/globals';

export class BadgeRefreshDriver {
  private readonly readCount = jest.fn<() => Promise<number>>();
  private readonly publishCount = jest.fn<(count: number) => Promise<void>>();

  constructor() {
    this.publishCount.mockResolvedValue(undefined);
  }

  readonly given = {
    count: (count: number) => {
      this.readCount.mockResolvedValueOnce(count);

      return this;
    },
    countFailure: (error: Error) => {
      this.readCount.mockRejectedValueOnce(error);

      return this;
    },
    countRead: (read: Promise<number>) => {
      this.readCount.mockReturnValueOnce(read);

      return this;
    },
  };

  readonly get = {
    readCount: () => this.readCount,
    publishCount: () => this.publishCount,
  };
}
