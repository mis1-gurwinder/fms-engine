-- v27: role structure from management notes
-- PC: only checks the stage and marks DONE or sends back to doer.
DELETE FROM role_permissions rp USING roles r, permissions p
WHERE rp.role_id=r.id AND rp.permission_id=p.id AND r.code='PC'
  AND p.code NOT IN ('FMS_VIEW','PROJECT_VIEW','PC_REVIEW','PC_DECISION');
-- MDO / MIS (mis, mis1): full access to everything.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='MDO'
ON CONFLICT DO NOTHING;
-- MD: full access to everything, same as MDO / MIS.
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='MD'
ON CONFLICT DO NOTHING;
-- EA / HR: view and monitor only (no action permissions).
DELETE FROM role_permissions rp USING roles r, permissions p
WHERE rp.role_id=r.id AND rp.permission_id=p.id AND r.code='EA'
  AND p.code NOT IN ('CONTROL_TOWER_VIEW','FMS_VIEW','PROJECT_VIEW','AUDIT_VIEW','USER_VIEW','REPORT_VIEW');
