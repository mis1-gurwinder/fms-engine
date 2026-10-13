-- v29: exact delay in seconds (hours/minutes/seconds shown per stage)
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS delay_seconds BIGINT;
