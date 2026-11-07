CREATE TABLE files_blob_candidates (
 object_key VARCHAR(128) NOT NULL PRIMARY KEY,
 size_bytes BIGINT NOT NULL,
 detached_at TIMESTAMP NOT NULL,
 ready_at TIMESTAMP NOT NULL,
 retry_at TIMESTAMP NOT NULL
);
CREATE INDEX files_blob_candidates_due ON files_blob_candidates (retry_at, object_key);
