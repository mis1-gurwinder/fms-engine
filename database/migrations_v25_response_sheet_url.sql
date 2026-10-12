-- v25: each stage's Google response Sheet link (PC review button)
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS response_sheet_url TEXT;
