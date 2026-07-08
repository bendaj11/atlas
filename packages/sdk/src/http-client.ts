export interface AtlasHttpRequestOptions extends Omit<RequestInit, "method"> {}

export interface AtlasHttpClient {
  request<TResponse = Response>(method: string, url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse>;
  get<TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse>;
  post<TResponse = Response>(url: RequestInfo | URL, body?: BodyInit | null, options?: AtlasHttpRequestOptions): Promise<TResponse>;
  put<TResponse = Response>(url: RequestInfo | URL, body?: BodyInit | null, options?: AtlasHttpRequestOptions): Promise<TResponse>;
  patch<TResponse = Response>(url: RequestInfo | URL, body?: BodyInit | null, options?: AtlasHttpRequestOptions): Promise<TResponse>;
  delete<TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse>;
  head<TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse>;
  options<TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse>;
}

export type AtlasFetchHttpClient = typeof fetch;
export type AtlasHttpClientInput = AtlasHttpClient | AtlasFetchHttpClient;

export class HttpClient implements AtlasHttpClient {
  constructor(private readonly fetchClient: AtlasFetchHttpClient = globalThis.fetch) {}

  request = <TResponse = Response>(method: string, url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    if (typeof this.fetchClient !== "function") {
      throw new Error("This Atlas host has not configured an HTTP client.");
    }
    return this.fetchClient(url, { ...options, method }) as Promise<TResponse>;
  };

  get = <TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    return this.request("GET", url, options);
  };

  post = <TResponse = Response>(url: RequestInfo | URL, body?: BodyInit | null, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    return this.request("POST", url, withBody(options, body));
  };

  put = <TResponse = Response>(url: RequestInfo | URL, body?: BodyInit | null, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    return this.request("PUT", url, withBody(options, body));
  };

  patch = <TResponse = Response>(url: RequestInfo | URL, body?: BodyInit | null, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    return this.request("PATCH", url, withBody(options, body));
  };

  delete = <TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    return this.request("DELETE", url, options);
  };

  head = <TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    return this.request("HEAD", url, options);
  };

  options = <TResponse = Response>(url: RequestInfo | URL, options?: AtlasHttpRequestOptions): Promise<TResponse> => {
    return this.request("OPTIONS", url, options);
  };
}

export function normalizeHttpClient(httpClient: AtlasHttpClientInput | undefined): AtlasHttpClient {
  if (!httpClient) return new HttpClient();
  if (typeof httpClient === "function") return new HttpClient(httpClient);
  return httpClient;
}

function withBody(options: AtlasHttpRequestOptions | undefined, body: BodyInit | null | undefined): AtlasHttpRequestOptions | undefined {
  return body === undefined ? options : { ...options, body };
}
