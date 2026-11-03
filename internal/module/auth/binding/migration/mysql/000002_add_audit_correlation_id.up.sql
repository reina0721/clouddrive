ALTER TABLE auth_audit_events ADD COLUMN correlation_id VARCHAR(128) NOT NULL DEFAULT '';
CREATE INDEX ix_auth_audit_events_correlation ON auth_audit_events(correlation_id);
