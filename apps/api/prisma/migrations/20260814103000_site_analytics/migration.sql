-- Statistiques first-party du site public Coffria.
CREATE TABLE IF NOT EXISTS site_analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(20) NOT NULL,
  visitor_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  path VARCHAR(500) NOT NULL,
  target VARCHAR(500),
  label VARCHAR(300),
  referrer TEXT,
  country VARCHAR(120),
  country_code VARCHAR(8),
  region VARCHAR(160),
  city VARCHAR(160),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_analytics_created_at ON site_analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_event_path ON site_analytics_events(event_type, path, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_visitor ON site_analytics_events(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_session ON site_analytics_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_analytics_geo ON site_analytics_events(country_code, city, created_at DESC);
