DROP INDEX ix_auth_audit_events_correlation;
ALTER TABLE auth_audit_events DROP COLUMN correlation_id;
