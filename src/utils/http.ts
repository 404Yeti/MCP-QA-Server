export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number; // milliseconds
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  json: unknown | null;
  duration: number; // milliseconds
}

/**
 * Make an HTTP request using Node's built-in fetch.
 * Returns parsed response with timing info.
 */
export async function httpRequest(
  url: string,
  options: HttpRequestOptions = {}
): Promise<HttpResponse> {
  const { method = "GET", headers = {}, body, timeout = 30000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const start = performance.now();

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body !== undefined && method !== "GET" && method !== "HEAD") {
      if (typeof body === "string") {
        fetchOptions.body = body;
      } else {
        fetchOptions.body = JSON.stringify(body);
        if (!headers["Content-Type"] && !headers["content-type"]) {
          (fetchOptions.headers as Record<string, string>)["Content-Type"] =
            "application/json";
        }
      }
    }

    const response = await fetch(url, fetchOptions);
    const duration = performance.now() - start;
    const responseBody = await response.text();

    let json: unknown | null = null;
    try {
      json = JSON.parse(responseBody);
    } catch {
      // Not JSON — that's fine
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      json,
      duration: Math.round(duration),
    };
  } finally {
    clearTimeout(timer);
  }
}
