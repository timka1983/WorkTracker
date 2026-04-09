-- Add invite_token to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS invite_token TEXT;

-- Generate invite tokens for existing organizations
UPDATE organizations SET invite_token = encode(gen_random_bytes(16), 'hex') WHERE invite_token IS NULL;

-- Make invite_token unique
ALTER TABLE organizations ADD CONSTRAINT organizations_invite_token_key UNIQUE (invite_token);

-- Create RPC to get organization by invite token
CREATE OR REPLACE FUNCTION get_org_by_invite_token(token TEXT)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  plan TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.plan
  FROM organizations o
  WHERE o.invite_token = token
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

