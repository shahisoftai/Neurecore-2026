# {Agent Type} — Policy Document

**Version**: 1.0  
**Last Updated**: {Date}  
**Agent Type**: {Type}  
**Department**: {Department}  
**Policy ID**: `POL-{DEPT}-{AGENT}-{VERSION}`

---

## 1. Role & Purpose

{Detailed description of the agent's role in the organization, including:

- Primary responsibilities
- Key stakeholders
- Decision-making authority
- Reporting structure
  }

### 1.1 Scope

| Scope Item              | Value                                           |
| ----------------------- | ----------------------------------------------- |
| **Data Classification** | {Public / Internal / Confidential / Restricted} |
| **Geographic Scope**    | {Global / Regional / Country-specific}          |
| **Business Units**      | {List of supported business units}              |

---

## 2. Allowed Actions

### 2.1 Approved Tools

| Tool Name   | Purpose        | Justification            |
| ----------- | -------------- | ------------------------ |
| `tool.name` | {What it does} | {Business justification} |
| `tool.name` | {What it does} | {Business justification} |

### 2.2 Approved Data Access

| Data Source                        | Access Level | Purpose                        |
| ---------------------------------- | ------------ | ------------------------------ |
| Read: `{data_source}`              | Read-only    | {Justification}                |
| Write: `{data_source}`             | Read-write   | {Justification}                |
| No access: `{restricted_resource}` | Blocked      | {Regulatory/compliance reason} |

### 2.3 Approved Network Targets

| Domain     | Purpose    | Port/Protocol |
| ---------- | ---------- | ------------- |
| `{domain}` | {What for} | HTTPS/443     |
| `{domain}` | {What for} | HTTPS/443     |

### 2.4 Approved API Endpoints

| Endpoint Pattern      | Method    | Purpose               |
| --------------------- | --------- | --------------------- |
| `/api/v1/finance/*`   | GET, POST | Financial data access |
| `/api/v1/inventory/*` | GET       | Inventory queries     |

---

## 3. Forbidden Actions

### 3.1 Prohibited Commands

These shell commands are **ALWAYS blocked** regardless of context:

| Command Pattern  | Why Blocked             | Risk Level |
| ---------------- | ----------------------- | ---------- |
| `rm -rf /`       | Recursive root deletion | CRITICAL   |
| `dd *`           | Direct disk write       | CRITICAL   |
| `mkfs`           | Filesystem format       | CRITICAL   |
| `> /etc/*`       | System file write       | CRITICAL   |
| `chmod 777`      | Permission escalation   | HIGH       |
| `wget ... \| sh` | Remote code execution   | HIGH       |
| `curl ... \| sh` | Remote code execution   | HIGH       |

### 3.2 Prohibited Access

| Resource                     | Why Forbidden            | Alternative                     |
| ---------------------------- | ------------------------ | ------------------------------- |
| `/admin` endpoints           | Privilege escalation     | Request via supervisor          |
| `/api/v1/tenants/{id}/*`     | Cross-tenant data access | Use tenant-scoped endpoints     |
| Direct database manipulation | Data integrity risk      | Use authorized API endpoints    |
| `/root/*`                    | System file access       | Not required for business tasks |

### 3.3 Prohibited Behaviors

| Behavior                                   | Reason                    | Detection Method          |
| ------------------------------------------ | ------------------------- | ------------------------- |
| Executing code from untrusted sources      | Malware risk              | Code signing verification |
| Transmitting credentials in logs           | Credential exposure       | Log monitoring            |
| Accessing data outside assigned tenant     | Data isolation violation  | TenantId enforcement      |
| Modifying system configurations            | Security policy violation | Audit logging             |
| Accessing `{specific_prohibited_resource}` | {Reason}                  | {Detection}               |

---

## 4. Input Validation Rules

### 4.1 Prompt Injection Detection

**Blocked Patterns:**

| Pattern                        | Example                       | Severity |
| ------------------------------ | ----------------------------- | -------- |
| `<\|.*\|>`                     | Generic instruction override  | HIGH     |
| `ignore previous instructions` | Direct instruction override   | CRITICAL |
| `disregard.*instructions`      | Indirect instruction override | HIGH     |
| `<script>` tags                | Cross-site scripting          | MEDIUM   |

**Action on Detection:**

1. Log the attempt with full context
2. Quarantine the session
3. Alert security team
4. Terminate agent execution

### 4.2 Command Validation

All shell commands must pass this validation:

```regex
^[a-zA-Z0-9_\-./ ]+$
```

**Forbidden:**

- Pipe operators (`|`) except for allowed commands
- Semicolons (`;`)
- Environment variables in untrusted input
- Path traversal (`../`)

### 4.3 File Path Validation

| Rule                                | Pattern                     | Example Blocked       |
| ----------------------------------- | --------------------------- | --------------------- |
| No absolute paths outside workspace | `^/workspace/`              | `/etc/passwd`         |
| No path traversal                   | `禁止../`                   | `../../../etc/passwd` |
| No system directories               | `^/(etc\|root\|bin\|sbin)/` | `/etc/shadow`         |

---

## 5. Escalation Procedures

| Scenario                    | Immediate Action                 | Contact       | SLA    |
| --------------------------- | -------------------------------- | ------------- | ------ |
| Blocked command attempt     | Log + alert                      | Security team | 15 min |
| Prompt injection detected   | Quarantine session               | Security team | 15 min |
| Cross-tenant access attempt | Immediate block + alert          | SOC           | 5 min  |
| Unauthorized data access    | Terminate + investigate          | Compliance    | 30 min |
| Credential in logs          | Rotate credentials + investigate | Security      | 1 hour |

### 5.1 Incident Response Flow

```
Detection → Classification → Containment → Investigation → Resolution → Lessons Learned
    ↓             ↓               ↓              ↓              ↓              ↓
  Automated    Security Team    Session        Root Cause    Policy Update   Process
  Logging      Triage          Isolation       Analysis      & Training      Improvement
```

---

## 6. Compliance Mapping

| Regulation    | Requirement          | Implementation                     | Verification      |
| ------------- | -------------------- | ---------------------------------- | ----------------- |
| **SOC 2**     | Data isolation       | TenantId filtering on all queries  | Automated tests   |
| **SOC 2**     | Access logging       | AuditInterceptor logs all actions  | Log review        |
| **GDPR**      | Data minimization    | Policy restricts data access       | Access audits     |
| **GDPR**      | Right to explanation | Audit trail for decisions          | Compliance report |
| **ISO 27001** | Asset classification | Policy defines data classification | Quarterly review  |
| **ISO 27001** | Secure development   | Code review for security           | PR checks         |

### 6.1 Audit Requirements

| Audit Type          | Frequency    | Owner         | Deliverable            |
| ------------------- | ------------ | ------------- | ---------------------- |
| Access review       | Monthly      | Security team | Access report          |
| Policy compliance   | Quarterly    | Compliance    | Compliance attestation |
| Incident response   | Per incident | Security team | Incident report        |
| Penetration testing | Annually     | External      | Pentest report         |

---

## 7. Tool-Specific Rules

### 7.1 Shell/Terminal Tools

| Permission             | Required                     | Justification     |
| ---------------------- | ---------------------------- | ----------------- |
| Execute shell commands | ❌ NO                        | Policy violation  |
| Read filesystem        | ✅ YES (workspace only)      | File operations   |
| Write filesystem       | ✅ YES (workspace only)      | Output generation |
| Network access         | ✅ YES (whitelisted domains) | API calls         |

### 7.2 API Client Tools

| Permission      | Required      | Justification                     |
| --------------- | ------------- | --------------------------------- |
| GET requests    | ✅ YES        | Data retrieval                    |
| POST requests   | ⚠️ RESTRICTED | Write operations require approval |
| DELETE requests | ❌ NO         | Data deletion not permitted       |
| Rate limiting   | ✅ ENFORCED   | 100 requests/minute max           |

### 7.3 Database Tools

| Permission     | Required           | Justification |
| -------------- | ------------------ | ------------- |
| SELECT queries | ✅ YES (read-only) | Data analysis |
| INSERT queries | ❌ NO              | Not required  |
| UPDATE queries | ❌ NO              | Not required  |
| DELETE queries | ❌ NO              | Not required  |

---

## 8. Version History

| Version | Date   | Author   | Changes                 |
| ------- | ------ | -------- | ----------------------- |
| 1.0     | {Date} | {Author} | Initial policy creation |

---

## 9. Approval

| Role               | Name   | Signature    | Date   |
| ------------------ | ------ | ------------ | ------ |
| Policy Owner       | {Name} | ****\_\_**** | {Date} |
| Security Review    | {Name} | ****\_\_**** | {Date} |
| Compliance Review  | {Name} | ****\_\_**** | {Date} |
| Executive Approval | {Name} | ****\_\_**** | {Date} |

---

**Document ID**: `POL-{DEPT}-{AGENT}-1.0`  
**Classification**: {Confidential}  
**Retention**: 7 years
