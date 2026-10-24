CREATE TABLE IF NOT EXISTS call_reports (
 call_id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL,
 caller TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'general',
 urgent INTEGER NOT NULL DEFAULT 0,
 summary TEXT NOT NULL DEFAULT '',
 duration INTEGER NOT NULL DEFAULT 0,
 ended_reason TEXT NOT NULL DEFAULT '',
 email_status TEXT NOT NULL DEFAULT 'pending',
 sms_status TEXT NOT NULL DEFAULT 'pending',
 email_attempts INTEGER NOT NULL DEFAULT 0,
 sms_attempts INTEGER NOT NULL DEFAULT 0,
 last_error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_call_reports_date ON call_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_call_reports_status ON call_reports(email_status,sms_status);