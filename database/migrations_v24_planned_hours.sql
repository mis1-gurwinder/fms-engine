-- v24: planned hours per stage are optional (NULL = no deadline, no delay calculated)
ALTER TABLE workflow_steps ALTER COLUMN planned_tat_minutes DROP DEFAULT;
ALTER TABLE workflow_steps ALTER COLUMN planned_tat_minutes DROP NOT NULL;
