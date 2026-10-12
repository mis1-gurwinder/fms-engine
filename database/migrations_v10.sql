-- v10: PC-editable, versioned stage form configuration.
CREATE TABLE IF NOT EXISTS form_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fms_id UUID REFERENCES fms(id) ON DELETE CASCADE,
  step_id UUID REFERENCES workflow_steps(id) ON DELETE CASCADE,
  form_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  responsible_name TEXT,
  responsible_email TEXT,
  responsible_phone TEXT,
  delivery_channels JSONB NOT NULL DEFAULT '["email"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(form_key, version)
);

CREATE TABLE IF NOT EXISTS form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_version_id UUID NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  system_locked BOOLEAN NOT NULL DEFAULT false,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  help_text TEXT,
  UNIQUE(form_version_id, question_key)
);

ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS approved_form_version_id UUID REFERENCES form_versions(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS form_version INTEGER;
CREATE INDEX IF NOT EXISTS idx_form_versions_key ON form_versions(form_key);
CREATE INDEX IF NOT EXISTS idx_form_questions_version ON form_questions(form_version_id, position);

ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS responsible_name TEXT;
ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS responsible_email TEXT;
ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS responsible_phone TEXT;
ALTER TABLE form_versions ADD COLUMN IF NOT EXISTS delivery_channels JSONB NOT NULL DEFAULT '["email"]'::jsonb;
