-- Live, continuously-updated confidence-ranked differential (see
-- CONFIDENCE_TRACKING in the system prompt) attached to each assistant
-- turn, so the client can render/restore the "current thinking" panel
-- without needing to re-derive it from scratch on reload.
alter table conversations add column if not exists differential jsonb;
