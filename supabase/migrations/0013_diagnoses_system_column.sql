-- Carries the system implicated at Stage 3 (Narrow) / Stage 6 (Diagnosis)
-- forward so the Verify Fix stage can write a complete case_precedents row
-- without re-asking or re-inferring it.
alter table diagnoses add column if not exists system text;
