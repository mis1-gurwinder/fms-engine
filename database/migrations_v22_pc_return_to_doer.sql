-- v22: Minimal stage timing fields and PC return-to-doer feedback.
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS pc_feedback TEXT;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS correction_requested_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_workflow_steps_correction_requested_at ON workflow_steps(correction_requested_at);
