# Connectors - Design Notes

Connectors are pluggable adapters that implement small, focused interfaces (`IContactSync`, `ILeadSync`, etc.).

Design principles:
- Interface Segregation: expose only necessary sync methods.
- Open/Closed: register new connectors via `ConnectorRegistry` without changing existing code.
- Dependency Inversion: consumers depend on `IConnectorFactory`/`ConnectorRegistry`.

Security:
- OAuth credentials stored per-tenant and encrypted.
- Connectors run background syncs with idempotency and retry logic.
