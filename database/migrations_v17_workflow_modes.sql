-- FMS v17: support PDF-template and manual workflow definitions.
-- Run after migrations_v16_google_form_workflow.sql.
ALTER TABLE fms ADD COLUMN IF NOT EXISTS workflow_mode text NOT NULL DEFAULT 'MANUAL';
ALTER TABLE fms ADD COLUMN IF NOT EXISTS source_document_name text;

UPDATE fms SET workflow_mode = 'MANUAL' WHERE workflow_mode IS NULL OR workflow_mode NOT IN ('PDF_TEMPLATE','MANUAL');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fms_workflow_mode_check') THEN
    ALTER TABLE fms ADD CONSTRAINT fms_workflow_mode_check CHECK (workflow_mode IN ('PDF_TEMPLATE','MANUAL'));
  END IF;
END $$;
