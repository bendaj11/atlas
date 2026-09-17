import {
  extractErrorMessage,
  isRetryableHttpStatus,
  withExponentialRetry,
  HttpStatusError,
} from '../../shared/index.js';
import { NetworkLimiter } from '../network-limiter/network-limiter.js';
import type { VerificationContext } from '../types.js';

type ResponseConsumer = (response: Response) => Promise<void>;

export class VerifiedFetch {
  private readonly network: NetworkLimiter;

  constructor(
    private readonly fetchResource: typeof fetch,
    concurrency: number,
  ) {
    this.network = new NetworkLimiter(concurrency);
  }

  async checked({
    url,
    subject,
    context,
    consume,
  }: {
    url: URL;
    subject: string;
    context: VerificationContext;
    consume?: ResponseConsumer;
  }): Promise<Response | undefined> {
    try {
      const response = await this.response({ url, context, consume });

      if (!response.ok) {
        context.checks.fail(
          subject,
          `${url.href} returned ${response.status} ${response.statusText}.`,
        );

        return undefined;
      }

      return response;
    } catch (error) {
      context.checks.fail(
        subject,
        `${url.href} could not be fetched: ${extractErrorMessage(error)}`,
      );

      return undefined;
    }
  }

  response({
    url,
    context,
    limitConcurrency = true,
    consume,
  }: {
    url: URL;
    context: VerificationContext;
    limitConcurrency?: boolean;
    consume?: ResponseConsumer;
  }): Promise<Response> {
    const request = async (): Promise<Response> => {
      const response = await this.fetchResource(url, {
        headers: { Origin: context.hostOrigin },
        cache: 'no-store',
        signal: AbortSignal.timeout(context.timeoutMs),
      });

      if (isRetryableHttpStatus(response.status)) {
        throw new HttpStatusError(
          `${url.href} returned HTTP ${response.status}.`,
          response.status,
        );
      }

      if (response.ok) await consume?.(response);

      return response;
    };

    return withExponentialRetry(() =>
      limitConcurrency ? this.network.run(request) : request(),
    );
  }
}

export async function parseJsonResponse({
  response,
  subject,
  context,
}: {
  response: Response;
  subject: string;
  context: VerificationContext;
}): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    context.checks.fail(subject, `Invalid JSON: ${extractErrorMessage(error)}`);

    return undefined;
  }
}
