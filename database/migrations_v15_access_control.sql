-- v15: Google Workspace user authorization + role/permission model.
-- Google answers WHO the user is; these tables answer WHAT the user may do.

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_all_plants BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_all_departments BOOLEAN NOT NULL DEFAULT true;

UPDATE users SET role_code = upper(role) WHERE role_code IS NULL;

INSERT INTO roles(code,name,description) VALUES
('MD','Managing Director','Highest management visibility and control across the FMS Engine, including operational oversight and authorized management actions.'),
('MDO','MIS / MDO Administrator','System and FMS administrator. Configures FMS definitions, users, assignments, workflows and management reporting.'),
('EA','Executive Assistant / HR','Monitoring and reporting access, with HR-oriented scope. Can visualize assigned organizational information but is not an operational workflow approver by default.'),
('PC','Process Coordinator','Operational workflow controller. Reviews stage submissions, controls DONE/CORRECTION/HOLD/EXCEPTION decisions and manages stage progression.'),
('RESPONSIBLE','Responsible Person','Stage-assigned execution access only. Can receive and submit assigned forms/evidence; cannot approve or complete the stage.'),
('ADMIN','Platform Administrator','Technical platform administration. Reserved for authorized platform administrators.')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

INSERT INTO permissions(code,name,description) VALUES
('CONTROL_TOWER_VIEW','View Control Tower','View live KPIs, active work, delays, exceptions and process performance.'),
('FMS_VIEW','View FMS Definitions','View reusable FMS definitions and workflow structures.'),
('FMS_CREATE','Create FMS Definitions','Create reusable FMS definitions with unique FMS codes.'),
('FMS_EDIT','Edit FMS Definitions','Modify authorized FMS definitions, stages and form configuration.'),
('FMS_DELETE','Delete FMS Definitions','Delete FMS definitions where policy permits.'),
('PROJECT_VIEW','View FMS Instances','View operational FMS instances/projects and their progress.'),
('PROJECT_CREATE','Start FMS Instances','Create operational instances/projects from reusable FMS definitions.'),
('WORKFLOW_CONTROL','Control Workflow','Control stage readiness, assignments, dependencies and progression.'),
('PC_REVIEW','Review Stage Submissions','Review responsible-person submissions and evidence.'),
('PC_DECISION','Approve / Hold / Exception','Mark a reviewed stage DONE, CORRECTION, HOLD or EXCEPTION.'),
('AUDIT_VIEW','View Audit Trail','View audit history of FMS Engine actions.'),
('USER_VIEW','View Users','View authorized FMS users and their roles/scopes.'),
('USER_MANAGE','Manage Users','Add, activate/deactivate and authorize FMS users.'),
('ROLE_MANAGE','Manage Roles & Permissions','Manage role and permission assignments.'),
('REPORT_VIEW','View Reports','View operational and management reporting.'),
('OWN_TASK_VIEW','View Assigned Tasks','View tasks assigned to the logged-in responsible person.'),
('OWN_FORM_SUBMIT','Submit Assigned Forms','Submit assigned stage forms and evidence.'),
('SYSTEM_CONFIG','System Configuration','Manage platform-level configuration.')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

-- MD: management control + visibility, but not technical role administration by default.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='MD' AND p.code IN (
 'CONTROL_TOWER_VIEW','FMS_VIEW','FMS_CREATE','FMS_EDIT','PROJECT_VIEW','PROJECT_CREATE',
 'WORKFLOW_CONTROL','PC_REVIEW','PC_DECISION','AUDIT_VIEW','USER_VIEW','REPORT_VIEW'
) ON CONFLICT DO NOTHING;

-- MDO/MIS: system/FMS administrator and reporting owner.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='MDO' AND p.code IN (
 'CONTROL_TOWER_VIEW','FMS_VIEW','FMS_CREATE','FMS_EDIT','FMS_DELETE','PROJECT_VIEW','PROJECT_CREATE',
 'WORKFLOW_CONTROL','PC_REVIEW','PC_DECISION','AUDIT_VIEW','USER_VIEW','USER_MANAGE','ROLE_MANAGE',
 'REPORT_VIEW','SYSTEM_CONFIG'
) ON CONFLICT DO NOTHING;

-- EA/HR: monitoring/reporting and user visibility; no workflow approval by default.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='EA' AND p.code IN ('CONTROL_TOWER_VIEW','FMS_VIEW','PROJECT_VIEW','AUDIT_VIEW','USER_VIEW','REPORT_VIEW')
ON CONFLICT DO NOTHING;

-- PC: operational workflow control, not platform/user administration.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='PC' AND p.code IN (
 'CONTROL_TOWER_VIEW','FMS_VIEW','PROJECT_VIEW','WORKFLOW_CONTROL','PC_REVIEW','PC_DECISION','AUDIT_VIEW','REPORT_VIEW'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='RESPONSIBLE' AND p.code IN ('FMS_VIEW','PROJECT_VIEW','OWN_TASK_VIEW','OWN_FORM_SUBMIT')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.code IN (SELECT code FROM permissions)
ON CONFLICT DO NOTHING;

-- Authoritative initial Google Workspace users supplied for the FMS Engine.
INSERT INTO users(employee_code,name,email,role,role_code,job_title,active,scope_all_plants,scope_all_departments)
VALUES
('DFPL-MD-001','Rahul Arora','rahul.arora@dinerofoodworks.com','MD','MD','Managing Director',true,true,true),
('DFPL-MDO-001','MIS 1','mis1@dinerofoodworks.com','MDO','MDO','MIS / MDO',true,true,true),
('DFPL-MDO-002','MIS','mis@dinerofoodworks.com','MDO','MDO','MIS / MDO',true,true,true),
('DFPL-EA-001','EA','ea@dinerofoodworks.com','EA','EA','Executive Assistant / HR',true,true,true),
('DFPL-PC-001','PC 1','pc1@dinerofoodworks.com','PC','PC','Process Coordinator',true,true,true)
ON CONFLICT (email) DO UPDATE SET
  role=EXCLUDED.role,
  role_code=EXCLUDED.role_code,
  job_title=EXCLUDED.job_title,
  active=true;

-- Make role_code authoritative for these users.
UPDATE users SET role_code=upper(role) WHERE email IN (
 'rahul.arora@dinerofoodworks.com',
 'mis1@dinerofoodworks.com',
 'mis@dinerofoodworks.com',
 'ea@dinerofoodworks.com',
 'pc1@dinerofoodworks.com'
);

CREATE INDEX IF NOT EXISTS idx_users_role_code ON users(role_code);
CREATE INDEX IF NOT EXISTS idx_users_active_email ON users(lower(email)) WHERE active=true;
