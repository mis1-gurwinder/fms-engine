-- v23: Stage 01 is emailed on FMS create; doer submission is recorded on the stage.
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS form_submitted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_workflow_steps_form_submitted ON workflow_steps(form_submitted_at);
