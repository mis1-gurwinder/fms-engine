# v21 Task Timestamp and Time-Taken Rule

1. When FMS is created, Stage 01 is activated. Its `started_at` and `planned_at` baseline are set to the FMS creation timestamp. No arbitrary 4-hour target or future due time is generated.
2. When PC marks a stage DONE, the server records `actual_completed_at = now()` and calculates `actual_tat_minutes = actual_completed_at - started_at`.
3. When PC marks the current stage DONE, the next stage becomes READY and its `started_at`/`planned_at` are set to the activation timestamp.
4. The dashboard shows total FMS, running/completed FMS, stage completion, active/locked stages, and stages over SLA. Over-SLA status is calculated only when a real `sla_minutes` target has been configured; elapsed time alone is not called a delay.
5. The stage card labels elapsed duration as `TIME TAKEN`. PC completion time is the actual timestamp. Google Form submission alone does not complete a stage.
