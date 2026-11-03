CREATE TABLE auth_audit_events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  operation TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_kind TEXT NOT NULL,
  subject_hash TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_hash TEXT NOT NULL,
  decision TEXT NOT NULL,
  outcome TEXT NOT NULL
);
CREATE INDEX ix_auth_audit_events_occurred ON auth_audit_events(occurred_at DESC);