import { sdkError } from './sdk-error.js';

export interface HttpRequestOptions extends Omit<RequestInit, 'method'> {}

export interface IHttpClient {
  request<TResponse = unknown>(request: HttpRequest): Promise<TResponse>;
  get<TResponse = unknown>(
    request: HttpRequestWithoutBody,
  ): Promise<TResponse>;
  post<TResponse = unknown>(request: HttpRequestWithBody): Promise<TResponse>;
  put<TResponse = unknown>(request: HttpRequestWithBody): Promise<TResponse>;
  patch<TResponse = unknown>(request: HttpRequestWithBody): Promise<TResponse>;
  delete<TResponse = unknown>(
    request: HttpRequestWithoutBody,
  ): Promise<TResponse>;
  head<TResponse = unknown>(
    request: HttpRequestWithoutBody,
  ): Promise<TResponse>;
  options<TResponse = unknown>(
    request: HttpRequestWithoutBody,
  ): Promise<TResponse>;
}

export type AtlasFetchHttpClient = typeof fetch;
export type HttpClientInput = IHttpClient | AtlasFetchHttpClient;

export interface HttpRequest {
  readonly method: string;
  readonly url: RequestInfo | URL;
  readonly options?: HttpRequestOptions;
}

export interface HttpRequestWithoutBody {
  readonly url: RequestInfo | URL;
  readonly options?: HttpRequestOptions;
}

export interface HttpRequestWithBody extends HttpRequestWithoutBody {
  readonly body?: BodyInit | null;
}

export class HttpClient implements IHttpClient {
  constructor(
    private readonly fetchClient: AtlasFetchHttpClient = globalThis.fetch,
  ) {}

  request = async <TResponse = unknown>({
    method,
    url,
    options,
  }: HttpRequest): Promise<TResponse> => {
    if (typeof this.fetchClient !== 'function') {
      throw sdkError(
        'Atlas cannot send the HTTP request because this host has no HTTP client.',
        {
          suggestedActions:
            'Configure httpClient when creating the host SDK, then retry the request.',
          code: 'ATLAS_HTTP_CLIENT_MISSING',
        },
      );
    }
    const response = await this.fetchClient(url, { ...options, method });
    return response.json() as Promise<TResponse>;
  };

  get = <TResponse = unknown>({
    url,
    options,
  }: HttpRequestWithoutBody): Promise<TResponse> => {
    return this.request({
      method: 'GET',
      url,
      ...(options ? { options } : {}),
    });
  };

  post = <TResponse = unknown>({
    url,
    body,
    options,
  }: HttpRequestWithBody): Promise<TResponse> => {
    return this.requestWithBody({
      method: 'POST',
      url,
      ...(body === undefined ? {} : { body }),
      ...(options ? { options } : {}),
    });
  };

  put = <TResponse = unknown>({
    url,
    body,
    options,
  }: HttpRequestWithBody): Promise<TResponse> => {
    return this.requestWithBody({
      method: 'PUT',
      url,
      ...(body === undefined ? {} : { body }),
      ...(options ? { options } : {}),
    });
  };

  patch = <TResponse = unknown>({
    url,
    body,
    options,
  }: HttpRequestWithBody): Promise<TResponse> => {
    return this.requestWithBody({
      method: 'PATCH',
      url,
      ...(body === undefined ? {} : { body }),
      ...(options ? { options } : {}),
    });
  };

  delete = <TResponse = unknown>({
    url,
    options,
  }: HttpRequestWithoutBody): Promise<TResponse> => {
    return this.request({
      method: 'DELETE',
      url,
      ...(options ? { options } : {}),
    });
  };

  head = <TResponse = unknown>({
    url,
    options,
  }: HttpRequestWithoutBody): Promise<TResponse> => {
    return this.request({
      method: 'HEAD',
      url,
      ...(options ? { options } : {}),
    });
  };

  options = <TResponse = unknown>({
    url,
    options,
  }: HttpRequestWithoutBody): Promise<TResponse> => {
    return this.request({
      method: 'OPTIONS',
      url,
      ...(options ? { options } : {}),
    });
  };

  private requestWithBody<TResponse>(
    request: HttpRequestWithBodyAndMethod,
  ): Promise<TResponse> {
    const { method, url, body, options } = request;
    const requestOptions = withBody(options, body);
    return this.request({
      method,
      url,
      ...(requestOptions ? { options: requestOptions } : {}),
    });
  }
}

export function normalizeHttpClient(
  httpClient: HttpClientInput | undefined,
): IHttpClient {
  if (!httpClient) return new HttpClient();
  if (typeof httpClient === 'function') return new HttpClient(httpClient);
  return httpClient;
}

function withBody(
  options: HttpRequestOptions | undefined,
  body: BodyInit | null | undefined,
): HttpRequestOptions | undefined {
  return body === undefined ? options : { ...options, body };
}

interface HttpRequestWithBodyAndMethod extends HttpRequestWithBody {
  readonly method: string;
}
