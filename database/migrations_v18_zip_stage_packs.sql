-- FMS v18: recognize ZIP-based plant stage packs as a workflow definition source.
-- Run after migrations_v17_workflow_modes.sql.
ALTER TABLE fms DROP CONSTRAINT IF EXISTS fms_workflow_mode_check;
ALTER TABLE fms ADD CONSTRAINT fms_workflow_mode_check
  CHECK (workflow_mode IN ('PDF_TEMPLATE', 'ZIP_TEMPLATE', 'MANUAL'));

UPDATE fms SET workflow_mode = 'MANUAL'
WHERE workflow_mode IS NULL OR workflow_mode NOT IN ('PDF_TEMPLATE', 'ZIP_TEMPLATE', 'MANUAL');
