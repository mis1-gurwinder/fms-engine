-- Run after the original schema if the database already exists.
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS planned_at TIMESTAMPTZ;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS google_form_url TEXT;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS form_status TEXT NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS form_sent_at TIMESTAMPTZ;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS form_submitted_at TIMESTAMPTZ;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS pc_review_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS actual_completed_at TIMESTAMPTZ;
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS delay_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS form_submitted_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pc_reviewed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_workflow_steps_form_status ON workflow_steps(form_status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_planned_at ON workflow_steps(planned_at);
CREATE INDEX IF NOT EXISTS idx_tasks_form_submitted_at ON tasks(form_submitted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_pc_reviewed_at ON tasks(pc_reviewed_at);
