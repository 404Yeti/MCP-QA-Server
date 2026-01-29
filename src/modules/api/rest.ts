import { httpRequest, type HttpResponse } from "../../utils/http.js";
import type { ApiEndpointTest, ApiAuthConfig } from "../../types.js";

export interface EndpointExecution {
  test: ApiEndpointTest;
  response: HttpResponse;
}

/**
 * Execute a single API endpoint test by making an HTTP request.
 * Handles auth header injection based on config.
 */
export async function executeEndpoint(
  baseUrl: string,
  test: ApiEndpointTest,
  auth: ApiAuthConfig | undefined,
  timeout: number
): Promise<EndpointExecution> {
  const url = new URL(test.path, baseUrl).toString();

  // Build headers
  const headers: Record<string, string> = { ...test.headers };

  // Inject auth unless skipped
  if (auth && !test.skipAuth) {
    applyAuth(headers, auth);
  }

  // Build query string
  let fullUrl = url;
  if (test.queryParams) {
    const params = new URLSearchParams(test.queryParams);
    fullUrl += `?${params.toString()}`;
  }

  const response = await httpRequest(fullUrl, {
    method: test.method,
    headers,
    body: test.body,
    timeout,
  });

  return { test, response };
}

function applyAuth(
  headers: Record<string, string>,
  auth: ApiAuthConfig
): void {
  switch (auth.type) {
    case "bearer": {
      const token = auth.tokenEnvVar
        ? process.env[auth.tokenEnvVar]
        : undefined;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      break;
    }
    case "api-key": {
      const key = auth.tokenEnvVar
        ? process.env[auth.tokenEnvVar]
        : undefined;
      const headerName = auth.headerName ?? "X-API-Key";
      if (key) {
        headers[headerName] = key;
      }
      break;
    }
    case "basic": {
      const username = auth.username ?? "";
      const password = auth.passwordEnvVar
        ? process.env[auth.passwordEnvVar] ?? ""
        : "";
      const encoded = Buffer.from(`${username}:${password}`).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
      break;
    }
  }
}
