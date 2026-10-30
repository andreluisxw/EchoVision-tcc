ALTER TABLE issues ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
UPDATE issues SET resolved_at=last_report_at WHERE lifecycle_status='resolved' AND resolved_at IS NULL;
CREATE TABLE admin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE CHECK(email=lower(trim(email))),
  password_hash text NOT NULL,
  role text NOT NULL CHECK(role IN ('owner','moderator')),
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE admin_sessions (
  token_hash char(64) PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES admin_accounts(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_sessions_account ON admin_sessions(account_id);
CREATE TABLE admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES admin_accounts(id),
  actor_name text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL CHECK(entity_type IN ('issue','account','auth')),
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  justification text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_entity ON admin_audit_events(entity_type,entity_id,created_at DESC,id DESC);
CREATE FUNCTION protect_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit events are immutable'; END; $$;
CREATE TRIGGER immutable_admin_audit BEFORE UPDATE OR DELETE ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION protect_admin_audit();
CREATE INDEX issues_resolved_at ON issues(resolved_at) WHERE lifecycle_status='resolved';
