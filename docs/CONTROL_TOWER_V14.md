# FMS Engine v14 — Live Control Tower

## Live-data rule

The Control Tower never invents operational numbers. KPI values, process rows, delays, exceptions, task states, completion trends and project data come from PostgreSQL-backed execution records.

When there is no real execution data, the dashboard shows an explicit empty state instead of fabricated KPI values.

## Operational model

FMS Definition → FMS Instance / Project → Stage Tasks → Google Form / Evidence → PC Review → PC Decision → Next Stage.

A form submission is not stage completion. The PC decision controls completion and next-stage activation.

## New live views

- Control Tower — live KPIs, active process performance, stage-status distribution and workload indicators.
- Projects / Instances — actual FMS executions.
- Project Control Center — project KPIs, complete workflow visualization and stage execution controls.
- Active Work — running instances.
- Delays — instances with actual overdue work.
- Exceptions — instances with open exceptions.
- Completed — completed instances.
- FMS Catalog — reusable FMS definitions.
- FMS Builder — reusable process configuration.
- Audit Trail — operational audit records.

## Backend endpoints added

- `GET /api/dashboard`
- `GET /api/instances`
- `GET /api/instances/:id`
- `POST /api/fms/:id/instances`
- `POST /api/tasks/:id/decision`

## Data source

PostgreSQL is the source of truth for live operational data. Browser localStorage remains only a UI fallback/cache for existing client behavior; it is not used to manufacture KPI or execution data.

## Security/configuration

Runtime `.env` files are intentionally excluded from the distributable ZIP. Use the supplied `.env.example` files and configure secrets locally on the server.
