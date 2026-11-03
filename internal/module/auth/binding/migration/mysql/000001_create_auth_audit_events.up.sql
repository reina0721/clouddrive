CREATE TABLE auth_audit_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  occurred_at DATETIME(6) NOT NULL,
  operation VARCHAR(128) NOT NULL,
  action VARCHAR(128) NOT NULL,
  actor_kind VARCHAR(32) NOT NULL,
  subject_hash VARCHAR(64) NOT NULL,
  resource_type VARCHAR(128) NOT NULL,
  resource_hash VARCHAR(64) NOT NULL,
  decision VARCHAR(32) NOT NULL,
  outcome VARCHAR(32) NOT NULL
) ENGINE=InnoDB;
CREATE INDEX ix_auth_audit_events_occurred ON auth_audit_events(occurred_at DESC);