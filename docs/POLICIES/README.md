# NeureCore Agent Policy Documents

**Version**: 1.0  
**Last Updated**: March 28, 2026  
**Status**: Phase 1 - In Progress

---

## Overview

This directory contains **Agent Policy Documents** for NeureCore's AI agents. These policies define what each agent type can and cannot do, serving as:

1. **Security Boundaries** — Define allowed/blocked tools, paths, and domains
2. **Compliance Mapping** — SOC 2, GDPR, ISO 27001 requirements
3. **NemoClaw Migration Bridge** — Policy-based permissions work with any agent framework

---

## Policy Index

| Agent Type                 | Department        | Status      | File                                                                                         |
| -------------------------- | ----------------- | ----------- | -------------------------------------------------------------------------------------------- |
| Finance Analyst            | FINANCE           | ✅ Template | [`FINANCE/finance-analyst.md`](FINANCE/finance-analyst.md)                                   |
| Supply Chain Specialist    | OPERATIONS        | ✅ Template | [`OPERATIONS/supply-chain-specialist.md`](OPERATIONS/supply-chain-specialist.md)             |
| Audit & Compliance Officer | RISK & COMPLIANCE | ✅ Template | [`RISK_COMPLIANCE/audit-compliance-officer.md`](RISK_COMPLIANCE/audit-compliance-officer.md) |

---

## Directory Structure

```
docs/POLICIES/
├── README.md                           # This file — Policy index
├── _templates/
│   └── AGENT_POLICY_TEMPLATE.md       # Reusable policy template
├── FINANCE/
│   ├── finance-analyst.md             # Finance Analyst policy
│   └── financial-risk-analyst.md      # Financial Risk Analyst policy
├── OPERATIONS/
│   ├── supply-chain-specialist.md     # Supply Chain Specialist policy
│   └── logistics-coordinator.md       # Logistics Coordinator policy
└── RISK_COMPLIANCE/
    ├── audit-compliance-officer.md    # Audit & Compliance Officer policy
    └── governance-agent.md            # Governance Agent policy
```

---

## Policy Document Structure

Each policy follows a standardized structure:

```markdown
# {Agent Type} — Policy Document

## 1. Role & Purpose

## 2. Allowed Actions

- 2.1 Approved Tools
- 2.2 Approved Data Access
- 2.3 Approved Network Targets

## 3. Forbidden Actions

- 3.1 Prohibited Commands
- 3.2 Prohibited Access
- 3.3 Prohibited Behaviors

## 4. Input Validation Rules

- 4.1 Prompt Injection Detection
- 4.2 Command Validation

## 5. Escalation Procedures

## 6. Compliance Mapping
```

---

## SOLID Compliance

All policy documents follow NeureCore's SOLID principles:

| Principle                 | How Policies Help                                             |
| ------------------------- | ------------------------------------------------------------- |
| **Single Responsibility** | Each policy covers ONE agent type                             |
| **Open/Closed**           | Extend via new policies, not modification                     |
| **Liskov Substitution**   | Agents can be swapped if policies match                       |
| **Interface Segregation** | Policy sections are modular                                   |
| **Dependency Inversion**  | Policies define abstractions consumed by Security Interceptor |

---

## Implementation Status

| Phase | Task                              | Status     |
| ----- | --------------------------------- | ---------- |
| 1     | Create policy template            | ✅ Done    |
| 1     | Finance Analyst policy            | ✅ Done    |
| 1     | Supply Chain Specialist policy    | ✅ Done    |
| 1     | Audit & Compliance Officer policy | ✅ Done    |
| 2     | Financial Risk Analyst policy     | ⬜ Pending |
| 2     | Logistics Coordinator policy      | ⬜ Pending |
| 2     | Governance Agent policy           | ⬜ Pending |

---

## Usage

### Loading a Policy

Policies are loaded by `SecurityPolicyProvider` at runtime:

```typescript
const policy = await securityPolicyProvider.getPolicy(
  "finance-analyst",
  tenantId,
);
```

### Validating Tool Access

```typescript
if (!securityPolicyProvider.isToolAllowed("bash", policy)) {
  throw new SecurityViolationException("Tool not permitted");
}
```

---

## Next Steps

1. **Phase 1** (IMMEDIATE): Create remaining policy documents
2. **Phase 2**: Integrate with `SecurityInterceptorService`
3. **Phase 3**: Add policy enforcement to LangGraph SECURITY_REVIEWER node

---

## References

- [`plans/Openclaw_security_hardened_plan.md`](../../plans/Openclaw_security_hardened_plan.md) — Full security hardening plan
- [`backend/src/modules/agents/security/`](../../backend/src/modules/agents/security/) — Security interceptor implementation
