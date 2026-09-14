import { describe, expect, it } from "vitest";
import { configuredConnectorRegistry } from "../../lib/connectors";

describe("connector registry", () => {
  it("reports disabled capabilities without synthetic health timestamps", () => {
    const registry = configuredConnectorRegistry({});
    expect(registry).toHaveLength(4);
    expect(registry.every((entry) => entry.status === "DISABLED")).toBe(true);
    expect(
      registry.every(
        (entry) =>
          entry.lastSuccessfulSync === null &&
          entry.lastFailedSync === null &&
          entry.circuitBreakerState === "unknown",
      ),
    ).toBe(true);
  });

  it("marks an enabled but incomplete search connector as misconfigured", () => {
    const search = configuredConnectorRegistry({
      CONNECTORS_ENABLED: "true",
      CONNECTORS_GLOBAL_KILL: "false",
      SEARCH_CONNECTOR_ENABLED: "true",
    }).find((entry) => entry.connectorId === "licensed-search");
    expect(search).toMatchObject({
      status: "MISCONFIGURED",
      credentialsStatus: "MISSING",
    });
  });
});
