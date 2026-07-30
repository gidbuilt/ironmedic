-- Corrects a Phase 1 schema bug caught on first real deploy: `make` was part
-- of the primary key on spn_codes, which makes Postgres treat it as
-- implicitly NOT NULL — but NULL is exactly the correct value for a
-- universal SAE J1939 parameter (see the comment on spn_codes.make in
-- 0001_init.sql). Switch to a surrogate primary key plus two partial unique
-- indexes so a NULL `make` is allowed while still preventing duplicate
-- (spn, make) pairs.
alter table spn_codes drop constraint if exists spn_codes_pkey;
alter table spn_codes add column if not exists id bigint generated always as identity;
alter table spn_codes add primary key (id);
-- Dropping a primary key does NOT clear the NOT NULL it implicitly set on
-- member columns — that has to be done explicitly.
alter table spn_codes alter column make drop not null;

create unique index if not exists spn_codes_universal_uidx on spn_codes (spn) where make is null;
create unique index if not exists spn_codes_oem_uidx on spn_codes (spn, make) where make is not null;
