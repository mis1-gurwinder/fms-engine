-- v21: Timing baseline is the task activation timestamp, not an invented four-hour due time.
-- Existing planned_at/started_at columns are reused. Actual elapsed duration is stored in actual_tat_minutes.
-- Optional sla_minutes can be set only when the business provides an actual SLA target.
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS sla_minutes INTEGER;
CREATE INDEX IF NOT EXISTS idx_workflow_steps_sla_minutes ON workflow_steps(sla_minutes);
