import { describe, it, expect } from "vitest";
import { validateEndpoint } from "../../../src/modules/api/validation.js";
import type { EndpointExecution } from "../../../src/modules/api/rest.js";
import type { ApiEndpointTest } from "../../../src/types.js";

function makeExecution(
  test: Partial<ApiEndpointTest>,
  response: { status: number; json?: unknown; duration?: number }
): EndpointExecution {
  return {
    test: {
      name: test.name ?? "Test",
      method: test.method ?? "GET",
      path: test.path ?? "/test",
      expectedStatus: test.expectedStatus ?? 200,
      ...test,
    } as ApiEndpointTest,
    response: {
      status: response.status,
      statusText: response.status === 200 ? "OK" : "Error",
      headers: {},
      body: JSON.stringify(response.json ?? {}),
      json: response.json ?? null,
      duration: response.duration ?? 50,
    },
  };
}

describe("API validation", () => {
  it("passes when status code matches", () => {
    const exec = makeExecution(
      { expectedStatus: 200 },
      { status: 200, json: {} }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("passed");
  });

  it("fails when status code does not match", () => {
    const exec = makeExecution(
      { expectedStatus: 200 },
      { status: 404 }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("404");
  });

  it("validates body type is array", () => {
    const exec = makeExecution(
      { expectedStatus: 200, expectedBody: { type: "array" } },
      { status: 200, json: [1, 2, 3] }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("passed");
  });

  it("fails when body type is wrong", () => {
    const exec = makeExecution(
      { expectedStatus: 200, expectedBody: { type: "array" } },
      { status: 200, json: { key: "value" } }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("type");
  });

  it("validates body hasKeys", () => {
    const exec = makeExecution(
      { expectedStatus: 200, expectedBody: { hasKeys: ["id", "name"] } },
      { status: 200, json: { id: 1, name: "Test", extra: true } }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("passed");
  });

  it("fails when body missing required keys", () => {
    const exec = makeExecution(
      { expectedStatus: 200, expectedBody: { hasKeys: ["id", "name", "email"] } },
      { status: 200, json: { id: 1, name: "Test" } }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("email");
  });

  it("validates body matches values", () => {
    const exec = makeExecution(
      {
        expectedStatus: 200,
        expectedBody: { matches: { status: "ok", count: 5 } },
      },
      { status: 200, json: { status: "ok", count: 5, extra: true } }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("passed");
  });

  it("fails when body values don't match", () => {
    const exec = makeExecution(
      {
        expectedStatus: 200,
        expectedBody: { matches: { status: "ok" } },
      },
      { status: 200, json: { status: "error" } }
    );
    const result = validateEndpoint(exec);
    expect(result.status).toBe("failed");
    expect(result.message).toContain("status");
  });

  it("includes response duration in result", () => {
    const exec = makeExecution(
      { expectedStatus: 200 },
      { status: 200, json: {}, duration: 123 }
    );
    const result = validateEndpoint(exec);
    expect(result.duration).toBe(123);
  });
});
