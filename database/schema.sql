
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fms_number BIGSERIAL UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(company_id, code)
);

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES plants(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(plant_id, code)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  department_id UUID REFERENCES departments(id),
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS fms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  plant_id UUID NOT NULL REFERENCES plants(id),
  department_id UUID REFERENCES departments(id),
  description TEXT,
  owner_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'DRAFT',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fms_id UUID NOT NULL REFERENCES fms(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  what_text TEXT,
  how_text TEXT,
  who_role TEXT,
  who_user_id UUID REFERENCES users(id),
  when_text TEXT,
  planned_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  google_form_url TEXT,
  form_status TEXT NOT NULL DEFAULT 'NOT_SENT',
  form_sent_at TIMESTAMPTZ,
  form_submitted_at TIMESTAMPTZ,
  pc_review_status TEXT NOT NULL DEFAULT 'PENDING',
  actual_completed_at TIMESTAMPTZ,
  actual_tat_minutes INTEGER,
  delay_minutes INTEGER,
  sla_minutes INTEGER,
  required BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(fms_id, step_no),
  UNIQUE(fms_id, code)
);

CREATE TABLE IF NOT EXISTS workflow_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fms_id UUID NOT NULL REFERENCES fms(id) ON DELETE CASCADE,
  from_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  to_step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL DEFAULT 'COMPLETE',
  condition_value TEXT
);

CREATE TABLE IF NOT EXISTS forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fms_id UUID NOT NULL REFERENCES fms(id) ON DELETE CASCADE,
  step_id UUID REFERENCES workflow_steps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  form_type TEXT NOT NULL DEFAULT 'CHECKLIST'
);

CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_code TEXT UNIQUE NOT NULL,
  fms_id UUID NOT NULL REFERENCES fms(id),
  plant_id UUID NOT NULL REFERENCES plants(id),
  status TEXT NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code TEXT UNIQUE NOT NULL,
  instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id),
  assignee_user_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'LOCKED',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  due_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  form_submitted_at TIMESTAMPTZ,
  pc_reviewed_at TIMESTAMPTZ,
  result TEXT,
  remarks TEXT
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  completed BOOLEAN NOT NULL DEFAULT false,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exception_code TEXT UNIQUE NOT NULL,
  task_id UUID REFERENCES tasks(id),
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  status TEXT NOT NULL DEFAULT 'OPEN',
  description TEXT NOT NULL,
  owner_user_id UUID REFERENCES users(id),
  due_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id),
  previous_state JSONB,
  new_state JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_instance ON tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

-- Stage-gated Google Form execution model
CREATE INDEX IF NOT EXISTS idx_workflow_steps_form_status ON workflow_steps(form_status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_planned_at ON workflow_steps(planned_at);
CREATE INDEX IF NOT EXISTS idx_tasks_form_submitted_at ON tasks(form_submitted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_pc_reviewed_at ON tasks(pc_reviewed_at);


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
