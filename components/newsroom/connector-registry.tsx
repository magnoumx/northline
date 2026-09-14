import { configuredConnectorRegistry } from "@/lib/connectors";

export function ConnectorRegistry() {
  const connectors = configuredConnectorRegistry();
  return (
    <section className="connector-registry" aria-labelledby="connector-title">
      <div>
        <p>CONFIGURATION TRUTH</p>
        <h2 id="connector-title">Connector registry</h2>
        <span>
          Health timestamps remain empty until a real sync is persisted.
        </span>
      </div>
      <div className="connector-registry__list">
        {connectors.map((connector) => (
          <article key={connector.connectorId}>
            <header>
              <div>
                <h3>{connector.provider}</h3>
                <code>{connector.connectorId}</code>
              </div>
              <strong data-status={connector.status}>
                {connector.status}
              </strong>
            </header>
            <dl>
              <div>
                <dt>Credentials</dt>
                <dd>{connector.credentialsStatus}</dd>
              </div>
              <div>
                <dt>Circuit</dt>
                <dd>{connector.circuitBreakerState}</dd>
              </div>
              <div>
                <dt>Failures</dt>
                <dd>{connector.failureCount}</dd>
              </div>
              <div>
                <dt>Last success</dt>
                <dd>{connector.lastSuccessfulSync ?? "Never"}</dd>
              </div>
              <div>
                <dt>Markets</dt>
                <dd>{connector.markets.join(", ")}</dd>
              </div>
              <div>
                <dt>Categories</dt>
                <dd>{connector.categories.join(", ")}</dd>
              </div>
            </dl>
            <p>{connector.termsAndAttributionNotes}</p>
            <small>
              {connector.rateLimits} Cost: {connector.estimatedCost}
            </small>
          </article>
        ))}
      </div>
    </section>
  );
}
