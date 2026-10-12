# FMS Engine v15 — Google Workspace Access Model

## Core rule

**Google Workspace authentication answers: WHO are you?**

**FMS authorization answers: WHAT are you allowed to do?**

The FMS Engine therefore does not create a separate Google OAuth client for every employee. One Google Workspace OAuth client is used by the portal; PostgreSQL stores the authorized users, roles, permissions and scope.

An account is admitted only when:

1. Google returns a verified Workspace identity.
2. The account belongs to `@dinerofoodworks.com`.
3. The email exists in the FMS `users` table.
4. The user is active.
5. The user's role grants the required permission for the requested action.

Unknown or inactive Workspace accounts are denied FMS access.

## Initial authorized users

| Workspace email | Role | Intended responsibility |
|---|---|---|
| `rahul.arora@dinerofoodworks.com` | MD | Highest management visibility and authorized control |
| `mis1@dinerofoodworks.com` | MDO | FMS/system administration and MIS |
| `mis@dinerofoodworks.com` | MDO | FMS/system administration and MIS |
| `ea@dinerofoodworks.com` | EA | Monitoring, reporting and HR-oriented visibility |
| `pc1@dinerofoodworks.com` | PC | Operational workflow control and stage review |

The v15 migration seeds these accounts as active and gives them all-plant/all-department scope initially. Scope can later be tightened in PostgreSQL.

## Role model

### MD — Managing Director

Highest management visibility and authorized control. The MD can view Control Tower, FMS definitions, operational instances, workflow state, audit information and management reporting. The MD can create/edit FMS definitions and perform authorized operational control actions. Technical role administration is not automatically included.

### MDO — MIS / MDO Administrator

System/FMS administrator. The MDO can configure reusable FMS definitions, stages and forms, start projects, manage workflow configuration, view audit/reporting, and manage authorized users and role/permission assignments.

### EA — Executive Assistant / HR

Monitoring/reporting role. EA can view Control Tower, FMS definitions, projects, audit and reports and can see the authorized-user directory. EA is not a workflow approver by default.

### PC — Process Coordinator

Operational workflow controller. PC controls stage progression after responsible-person submissions, reviews evidence, and can issue `DONE`, `CORRECTION`, `HOLD` or `EXCEPTION` decisions where the corresponding workflow API is enabled.

### Responsible Person

Stage-level execution role. A responsible person can see assigned work and submit the assigned form/evidence. A form submission does **not** itself complete the stage.

## Permission principle

Roles are collections of permissions. The application should check permissions at the API boundary, not merely hide buttons in React.

Examples already protected in v15:

- `FMS_CREATE` → FMS Builder creation endpoint.
- `FMS_EDIT` → stage/form configuration endpoints.
- `SYSTEM_CONFIG` → SMTP test endpoint.
- `WORKFLOW_CONTROL` → stage-form dispatch endpoint.
- `USER_VIEW` → authorized-user directory endpoint.

UI restrictions are additional UX protection, not the security boundary.

## Future scope model

The current five users are seeded with all-plant/all-department scope because the supplied requirement does not yet assign individual plant/department limits. Later, a user can be restricted to one or more plants/departments without changing Google authentication.
