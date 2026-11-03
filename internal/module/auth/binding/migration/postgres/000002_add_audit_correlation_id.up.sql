ALTER TABLE auth_audit_events ADD COLUMN correlation_id TEXT NOT NULL DEFAULT '';
CREATE INDEX ix_auth_audit_events_correlation ON auth_audit_events(correlation_id);
