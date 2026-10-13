# FMS Engine architecture

## Page model

The application deliberately separates operational contexts:

- FMS Plant Tower: aggregate PC view
- My Work: task queue
- FMS Catalog: configuration catalog
- FMS Detail: one FMS definition
- Instance: one execution of an FMS
- Task: one executable stage
- People: workload/accountability
- Exceptions: deviations/CAPA
- MIS: management reporting
- Builder: configuration authoring
- Audit: history

## Dependency model

```text
Task A
  │
  │ completion condition
  ▼
Task B READY
  │
  │ assigned + submitted + validated
  ▼
Task C READY
```

The frontend never directly "unlocks" a task. It calls the backend. The backend validates required checklist items and then evaluates the next configured dependency.

## What/How/Who/When

Every workflow step should carry:

- WHAT — activity/outcome
- HOW — procedure, checklist or form
- WHO — role/user responsible
- WHEN — trigger/SLA/deadline

## PC accountability

The PC dashboard should answer:

1. Who is working?
2. On which FMS?
3. On which task/stage?
4. Since when?
5. Due when?
6. What evidence is missing?
7. What is blocked?
8. Why is it blocked?
9. Who owns the next action?
10. What changed in the audit trail?

## Production evolution

Add authentication/RBAC middleware, object storage, full form submission tables, inspection/approval/CAPA modules, SLA scheduler and transactionally safe dependency evaluation before production deployment.

## v7 operational execution model — PC-controlled Google Forms

The Tata/Palda operating model is now explicitly modeled as:

`Project created → Stage N activated → responsible person receives only Stage N Google Form → form submitted → PC review → DONE / NOT DONE → if DONE record actual completion + delay → activate Stage N+1 → issue next stage form → repeat → final stage completes one FMS instance.`

### Access model

- **Operational responsible person:** receives/uses the stage-specific Google Form; no FMS Control application access is required.
- **PC:** main FMS controller. Sees every active instance, stage, responsible person, planned time, form status, submission status, PC decision, delay and dependency state. Only PC completion/approval can activate the next stage.
- **EC:** reviews operational status and exceptions.
- **MDO:** reviews plant/department performance and escalations.
- **MD:** executive KPI and consolidated performance view.

### State semantics

`FORM SUBMITTED` does not mean `STAGE COMPLETE`.

A stage becomes complete only when the PC approves it as `DONE` and configured completion conditions are satisfied. `NOT DONE` returns the stage for correction and leaves the next stage locked.

### Timing

Each stage can store:

- planned_at
- form_sent_at
- form_submitted_at
- pc_reviewed_at
- actual_completed_at
- delay_minutes

Delay is calculated as `actual_completed_at - planned_at` when a planned time exists.

### Google Forms

Google Forms are an input channel, not the system of record. PostgreSQL remains authoritative. The Node/Express API records form-issued/submitted events and the PC decision. A production Google Forms integration can populate the configured `google_form_url` and use the appropriate Google Workspace integration/webhook mechanism without changing the workflow engine.
