-- v14: FMS identity hardening
-- Adds a human-readable sequential FMS number while keeping UUID id as the internal primary key.

CREATE SEQUENCE IF NOT EXISTS fms_fms_number_seq;

ALTER TABLE fms ADD COLUMN IF NOT EXISTS fms_number BIGINT;

ALTER SEQUENCE fms_fms_number_seq OWNED BY fms.fms_number;
ALTER TABLE fms ALTER COLUMN fms_number SET DEFAULT nextval('fms_fms_number_seq');

SELECT setval('fms_fms_number_seq', COALESCE((SELECT MAX(fms_number) FROM fms),1), EXISTS (SELECT 1 FROM fms WHERE fms_number IS NOT NULL));
UPDATE fms SET fms_number = nextval('fms_fms_number_seq') WHERE fms_number IS NULL;
ALTER TABLE fms ALTER COLUMN fms_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_fms_fms_number ON fms(fms_number);

SELECT setval('fms_fms_number_seq', COALESCE((SELECT MAX(fms_number) FROM fms),1), true);
