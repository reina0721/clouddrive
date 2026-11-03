CREATE TABLE iam_accounts (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','disabled')), must_change_password INTEGER NOT NULL,
  security_revision INTEGER NOT NULL, failed_attempts INTEGER NOT NULL, locked_until DATETIME NULL,
  version INTEGER NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
);
CREATE TABLE iam_local_credentials (
  account_id TEXT PRIMARY KEY REFERENCES iam_accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL, updated_at DATETIME NOT NULL
);
CREATE TABLE iam_roles (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL,
  active INTEGER NOT NULL, archived INTEGER NOT NULL, system INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL
);
CREATE TABLE iam_account_roles (
  account_id TEXT NOT NULL REFERENCES iam_accounts(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
  active INTEGER NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY(account_id, role_id)
);
CREATE TABLE iam_role_permissions (
  role_id TEXT NOT NULL REFERENCES iam_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL, active INTEGER NOT NULL, updated_at DATETIME NOT NULL,
  PRIMARY KEY(role_id, permission_key)
);
CREATE TABLE iam_sessions (
  id_hash BLOB PRIMARY KEY, account_id TEXT NOT NULL REFERENCES iam_accounts(id) ON DELETE CASCADE,
  csrf_hash BLOB NOT NULL, security_revision INTEGER NOT NULL, created_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL, idle_expires_at DATETIME NOT NULL, absolute_expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL
);
CREATE INDEX ix_iam_sessions_account ON iam_sessions(account_id);
