-- Explicit repair procedure + verification steps, so a diagnosis isn't just
-- a root-cause name — it carries the concrete fix and how to confirm it
-- worked, per the REASON -> TEST -> DIAGNOSE -> REPAIR -> VERIFY core loop.
alter table diagnoses add column if not exists repair_steps jsonb not null default '[]';
alter table diagnoses add column if not exists verification_steps jsonb not null default '[]';
