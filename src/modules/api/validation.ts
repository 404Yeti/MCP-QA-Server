import type { TestResult } from "../../types.js";
import type { EndpointExecution } from "./rest.js";

/**
 * Validate an endpoint execution result against the test expectations.
 * Checks status code and response body structure.
 */
export function validateEndpoint(execution: EndpointExecution): TestResult {
  const { test, response } = execution;
  const failures: string[] = [];

  // Status code check
  if (response.status !== test.expectedStatus) {
    failures.push(
      `Status: expected ${test.expectedStatus}, got ${response.status}`
    );
  }

  // Body checks
  if (test.expectedBody) {
    const body = response.json;

    // Type check
    if (test.expectedBody.type) {
      const actualType = getJsonType(body);
      if (actualType !== test.expectedBody.type) {
        failures.push(
          `Body type: expected "${test.expectedBody.type}", got "${actualType}"`
        );
      }
    }

    // hasKeys check (body must be an object)
    if (test.expectedBody.hasKeys && body && typeof body === "object" && !Array.isArray(body)) {
      const obj = body as Record<string, unknown>;
      const missing = test.expectedBody.hasKeys.filter((key) => !(key in obj));
      if (missing.length > 0) {
        failures.push(`Body missing keys: ${missing.join(", ")}`);
      }
    }

    // matches check (shallow key-value equality)
    if (test.expectedBody.matches && body && typeof body === "object" && !Array.isArray(body)) {
      const obj = body as Record<string, unknown>;
      for (const [key, expectedValue] of Object.entries(test.expectedBody.matches)) {
        const actualValue = obj[key];
        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
          failures.push(
            `Body "${key}": expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
          );
        }
      }
    }
  }

  if (failures.length === 0) {
    return {
      name: `api:${test.name}`,
      module: "api",
      status: "passed",
      duration: response.duration,
      message: `${test.method} ${test.path} → ${response.status} (${response.duration}ms)`,
    };
  }

  return {
    name: `api:${test.name}`,
    module: "api",
    status: "failed",
    duration: response.duration,
    message: failures.join("; "),
    error: { message: failures.join("\n") },
  };
}

function getJsonType(
  value: unknown
): "object" | "array" | "string" | "number" | "null" | "boolean" | "unknown" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  if (t === "object") return "object";
  if (t === "string") return "string";
  if (t === "number") return "number";
  if (t === "boolean") return "boolean";
  return "unknown";
}
