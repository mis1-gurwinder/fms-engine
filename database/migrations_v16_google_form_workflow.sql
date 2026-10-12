-- v16: durable PC-controlled stage progression for external Google Forms.
ALTER TABLE workflow_steps
  ADD COLUMN IF NOT EXISTS execution_status TEXT NOT NULL DEFAULT 'LOCKED';

-- Initialize only FMS definitions that have not yet been progressed.
UPDATE workflow_steps ws
SET execution_status = CASE WHEN ws.step_no = 1 THEN 'READY' ELSE 'LOCKED' END
WHERE ws.execution_status = 'LOCKED'
  AND NOT EXISTS (
    SELECT 1 FROM workflow_steps prior
    WHERE prior.fms_id = ws.fms_id
      AND prior.step_no < ws.step_no
      AND prior.execution_status = 'DONE'
  );

CREATE INDEX IF NOT EXISTS idx_workflow_steps_execution_status
  ON workflow_steps(fms_id, execution_status, step_no);
