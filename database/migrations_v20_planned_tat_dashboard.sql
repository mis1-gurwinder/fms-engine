-- v20: planned stage TAT targets and live operational KPI support.
ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS planned_tat_minutes INTEGER NOT NULL DEFAULT 240;

-- Backfill a useful target from existing planned start/due sequencing where possible.
-- For existing records, 240 minutes is a safe editable default; it does not invent historical actuals.
UPDATE workflow_steps
SET planned_tat_minutes = GREATEST(15, FLOOR(EXTRACT(EPOCH FROM (planned_at - started_at)) / 60)::INTEGER)
WHERE planned_at IS NOT NULL AND started_at IS NOT NULL AND planned_at > started_at
  AND planned_tat_minutes = 240;

CREATE INDEX IF NOT EXISTS idx_workflow_steps_planned_tat ON workflow_steps(planned_tat_minutes);
