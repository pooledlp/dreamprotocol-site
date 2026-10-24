CREATE TABLE IF NOT EXISTS dream_calls (
 call_id TEXT PRIMARY KEY,
 received_at TEXT NOT NULL,
 started_at TEXT,
 ended_at TEXT,
 caller_number TEXT,
 category TEXT NOT NULL,
 priority TEXT NOT NULL,
 summary TEXT NOT NULL,
 duration_seconds INTEGER,
 ended_reason TEXT,
 email_status TEXT NOT NULL DEFAULT 'pending',
 updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dream_calls_received ON dream_calls(received_at DESC);
