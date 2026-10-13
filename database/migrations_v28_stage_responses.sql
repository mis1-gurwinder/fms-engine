-- v28: store Google Form answers inside the FMS Engine (PC reviews them on the stage page)
CREATE TABLE IF NOT EXISTS stage_responses (
  id BIGSERIAL PRIMARY KEY,
  fms_code TEXT NOT NULL,
  step_no INTEGER NOT NULL,
  respondent TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS stage_responses_stage_idx ON stage_responses (fms_code, step_no, submitted_at DESC);
