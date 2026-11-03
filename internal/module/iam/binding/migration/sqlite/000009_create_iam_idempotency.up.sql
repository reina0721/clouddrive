CREATE TABLE iam_idempotency_records (
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  completed INTEGER NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY(operation, idempotency_key)
);
