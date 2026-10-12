-- v14 master data. These are real selectable workspace masters, not demo FMS records.
INSERT INTO companies(code,name) VALUES ('DFPL_CIPL','DFPL / CIPL Workspace') ON CONFLICT (code) DO NOTHING;

INSERT INTO plants(company_id,code,name)
SELECT c.id,v.code,v.name FROM companies c
CROSS JOIN (VALUES
 ('IND_DFPL_TATA','Indore - DFPL - Tata'),
 ('IND_DFPL_SAFFOLA','Indore - DFPL - Saffola'),
 ('IND_DFPL_DINERO1','Indore - DFPL - Dinero1'),
 ('IND_DFPL_DINERO2','Indore - DFPL - Dinero2'),
 ('NAW_CIPL','Nawanshahr - CIPL'),
 ('NAW_DFPL','Nawanshahr - DFPL')
) AS v(code,name)
WHERE c.code='DFPL_CIPL'
ON CONFLICT (company_id,code) DO NOTHING;

INSERT INTO departments(plant_id,code,name)
SELECT p.id,v.code,v.name FROM plants p
CROSS JOIN (VALUES
 ('RAW_MATERIAL','Raw Material'),('QUALITY','Quality'),('PRODUCTION','Production'),('PACKING','Packing'),
 ('WAREHOUSE','Warehouse'),('DISPATCH','Dispatch'),('PURCHASE','Purchase'),('INVENTORY','Inventory'),
 ('MAINTENANCE','Maintenance'),('FINANCE','Finance'),('HR','HR'),('MIS','MIS'),('MANAGEMENT','Management')
) AS v(code,name)
WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.plant_id=p.id AND d.code=v.code);
