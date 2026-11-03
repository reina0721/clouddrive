CREATE TABLE organization_departments (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id TEXT NULL REFERENCES organization_departments(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL,
  archived BOOLEAN NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
CREATE INDEX ix_organization_departments_parent ON organization_departments(parent_id);
CREATE TABLE organization_positions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL,
  archived BOOLEAN NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
CREATE TABLE organization_account_departments (
  account_id TEXT PRIMARY KEY,
  department_id TEXT NOT NULL REFERENCES organization_departments(id) ON DELETE RESTRICT,
  assigned BOOLEAN NOT NULL,
  updated_at DATETIME NOT NULL
);
CREATE INDEX ix_organization_account_departments_department ON organization_account_departments(department_id);
CREATE TABLE organization_account_positions (
  account_id TEXT NOT NULL,
  position_id TEXT NOT NULL REFERENCES organization_positions(id) ON DELETE RESTRICT,
  assigned BOOLEAN NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY(account_id, position_id)
);
CREATE INDEX ix_organization_account_positions_position ON organization_account_positions(position_id);
