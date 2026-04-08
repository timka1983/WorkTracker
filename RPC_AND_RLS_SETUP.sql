-- RPC AND RLS SETUP SQL
-- Run this in Supabase SQL Editor

-- 1. Add supabase_auth_id column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_auth_id UUID;

-- 2. Create the link_current_session_to_user function
-- This function allows the current authenticated user (auth.uid()) 
-- to link their session to a specific record in the 'users' table.
CREATE OR REPLACE FUNCTION link_current_session_to_user(target_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET supabase_auth_id = auth.uid()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_payments ENABLE ROW LEVEL SECURITY;

-- 4. Create Helper Functions for RLS
-- Get the organization_id of the current user based on their supabase_auth_id
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS TEXT AS $$
  SELECT organization_id FROM users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Check if the current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT is_admin OR role IN ('EMPLOYER', 'SUPER_ADMIN') FROM users WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. Define RLS Policies

-- USERS TABLE
DROP POLICY IF EXISTS "Users visibility" ON users;
CREATE POLICY "Users visibility" ON users FOR SELECT 
USING (
  organization_id = get_user_org_id()
  OR supabase_auth_id = auth.uid()
  OR organization_id IN ('demo_org', 'initial_org')
);

-- WORK_LOGS TABLE
DROP POLICY IF EXISTS "Work logs isolation" ON work_logs;
CREATE POLICY "Work logs isolation" ON work_logs FOR ALL
USING (
  organization_id = get_user_org_id()
  OR organization_id IN ('demo_org', 'initial_org')
)
WITH CHECK (
  organization_id = get_user_org_id()
);

-- ORGANIZATIONS TABLE
DROP POLICY IF EXISTS "Org visibility" ON organizations;
CREATE POLICY "Org visibility" ON organizations FOR SELECT
USING (
  id = get_user_org_id()
  OR id IN ('demo_org', 'initial_org')
);

-- ACTIVE_SHIFTS TABLE
DROP POLICY IF EXISTS "Active shifts isolation" ON active_shifts;
CREATE POLICY "Active shifts isolation" ON active_shifts FOR ALL
USING (
  organization_id = get_user_org_id()
  OR organization_id IN ('demo_org', 'initial_org')
);

-- AUDIT_LOGS TABLE
DROP POLICY IF EXISTS "Audit logs isolation" ON audit_logs;
CREATE POLICY "Audit logs isolation" ON audit_logs FOR ALL
USING (
  organization_id = get_user_org_id()
  OR organization_id IN ('demo_org', 'initial_org')
);

-- MACHINES TABLE
DROP POLICY IF EXISTS "Machines isolation" ON machines;
CREATE POLICY "Machines isolation" ON machines FOR ALL
USING (
  organization_id = get_user_org_id()
  OR organization_id IN ('demo_org', 'initial_org')
);

-- POSITIONS TABLE
DROP POLICY IF EXISTS "Positions isolation" ON positions;
CREATE POLICY "Positions isolation" ON positions FOR ALL
USING (
  organization_id = get_user_org_id()
  OR organization_id IN ('demo_org', 'initial_org')
);

-- 6. Enable Realtime
BEGIN;
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS users, work_logs, active_shifts, organizations, audit_logs, machines, positions;
  ALTER PUBLICATION supabase_realtime ADD TABLE users, work_logs, active_shifts, organizations, audit_logs, machines, positions;
COMMIT;
