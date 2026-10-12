-- FMS v19: stage lifecycle timestamps, actual TAT, and delay reporting.
-- Run after migrations_v18_zip_stage_packs.sql.
ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_tat_minutes INTEGER;

-- Historical completed stages: derive actual TAT where possible from known timestamps.
UPDATE workflow_steps
SET actual_tat_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (actual_completed_at - started_at)) / 60)::INTEGER)
WHERE actual_tat_minutes IS NULL
  AND actual_completed_at IS NOT NULL
  AND started_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_steps_started_at ON workflow_steps(started_at);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_completed_at ON workflow_steps(actual_completed_at);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_delay ON workflow_steps(delay_minutes);
