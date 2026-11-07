CREATE TABLE files_property_definitions (
 id VARCHAR(32) NOT NULL PRIMARY KEY,
 revision BIGINT NOT NULL,
 definitions_json TEXT NOT NULL
);
