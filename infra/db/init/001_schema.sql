CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('lixo','esgoto','queimada','desmatamento','agua','ar')),
  description text,
  location geography(POINT,4326) NOT NULL,
  report_count integer NOT NULL DEFAULT 1 CHECK (report_count >= 1),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','corroborated','verified')),
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active','resolved')),
  visibility text NOT NULL DEFAULT 'visible'
    CHECK (visibility IN ('visible','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_report_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issues_location ON issues USING gist (location);
CREATE INDEX IF NOT EXISTS idx_issues_public ON issues (category, lifecycle_status, visibility, last_report_at DESC);

CREATE TABLE IF NOT EXISTS media_files (
  id uuid PRIMARY KEY,
  object_key text NOT NULL UNIQUE,
  mime_type text NOT NULL DEFAULT 'image/jpeg',
  width integer NOT NULL,
  height integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  ip_hash char(64) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('initial','confirmation')),
  description text,
  image_id uuid UNIQUE REFERENCES media_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_issue_created ON reports (issue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_ip_issue_created ON reports (issue_id, ip_hash, created_at DESC);
