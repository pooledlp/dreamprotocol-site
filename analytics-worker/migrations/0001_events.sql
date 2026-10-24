-- Run: npx wrangler d1 migrations apply dreamprotocol-metrics --remote
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  event TEXT NOT NULL,
  session_id TEXT NOT NULL,
  page TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_date ON analytics_events(event,created_at);
