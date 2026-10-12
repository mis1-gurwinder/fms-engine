-- v26: PC email per stage (notifications); add-stage support
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS pc_email TEXT;
