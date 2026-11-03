CREATE TABLE navigation_menu_policies (
  navigation_id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  parent_override TEXT NULL,
  order_override INTEGER NULL,
  catalog_revision TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL
);
